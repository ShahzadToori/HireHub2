'use strict';
/* Admin-facing WhatsApp channel-forwarder management — powers admin/whatsapp-settings.html.
 * Orchestrates the same manual steps documented for reconnecting the bot
 * (wipe session, request a pairing code, wait for link) without SSH access.
 * State is persisted to a file (not memory) because PM2 runs this app in
 * cluster mode — the request that starts a reconnect and the requests that
 * poll its progress can land on different workers.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const CF_DIR = path.join(__dirname, '..', '..', 'channel-forwarder');
const SESSION_DIR = path.join(CF_DIR, 'cron-session');
const LOCK_FILE = path.join(CF_DIR, '.reconnect.lock');
const STATE_FILE = path.join(CF_DIR, '.reconnect-state.json');
const LOG_FILE = '/var/log/smart-cron.log';

const ACTIVE_STATES = new Set(['starting', 'awaiting-code', 'code-ready']);
const STALE_LOCK_MS = 6 * 60 * 1000; // pair-link.js self-exits after 5 min

router.use(requireAdmin);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { state: 'idle' };
  }
}

function writeState(patch) {
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next));
  return next;
}

function clearLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// Self-heals an orphaned lock (e.g. the app restarted mid-reconnect and no
// worker is left listening for that child process's exit event).
function releaseStaleLockIfAny() {
  try {
    const stat = fs.statSync(LOCK_FILE);
    if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      clearLock();
      const state = readState();
      if (ACTIVE_STATES.has(state.state)) writeState({ state: 'timeout' });
    }
  } catch {}
}

function readLogTail(maxBytes = 50000) {
  try {
    const stat = fs.statSync(LOG_FILE);
    const size = Math.min(stat.size, maxBytes);
    const fd = fs.openSync(LOG_FILE, 'r');
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, stat.size - size);
    fs.closeSync(fd);
    return { text: buf.toString('utf8'), mtime: stat.mtime };
  } catch {
    return { text: '', mtime: null };
  }
}

function deriveConnectivity(logText) {
  const readyIdx = logText.lastIndexOf('✅ Smart cron bot ready!');
  const failIdx = Math.max(
    logText.lastIndexOf('Timeout waiting for WhatsApp connection.'),
    logText.lastIndexOf('❌ Disconnected:'),
    logText.lastIndexOf('📱 Scan this QR')
  );
  if (readyIdx === -1 && failIdx === -1) return null; // unknown — no signal yet
  return readyIdx > failIdx;
}

function recentActivity(logText, limit = 8) {
  const lines = logText.split('\n').filter(l =>
    l.includes('✅ Sent') || l.includes('❌ Failed to send') || l.includes('run start') || l.includes('run end')
  );
  return lines.slice(-limit).reverse();
}

// GET /api/admin/whatsapp/status
router.get('/status', (req, res) => {
  releaseStaleLockIfAny();
  const { text, mtime } = readLogTail();
  const reconnect = readState();
  let sessionExists = false;
  try { sessionExists = fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0; } catch {}

  res.json({
    success: true,
    connected: deriveConnectivity(text),
    lastLogWriteAt: mtime,
    sessionExists,
    cronPaused: fs.existsSync(LOCK_FILE),
    reconnect,
    activity: recentActivity(text),
    groupId: process.env.WHATSAPP_GROUP_ID || null,
    channelId: process.env.WHATSAPP_CHANNEL_ID || null,
  });
});

// POST /api/admin/whatsapp/reconnect/start  { phoneNumber? }
router.post('/reconnect/start', (req, res) => {
  releaseStaleLockIfAny();

  let phoneNumber = String(req.body.phoneNumber || '').replace(/[^0-9]/g, '');
  if (!phoneNumber) phoneNumber = (process.env.WHATSAPP_BOT_NUMBER || '').replace(/[^0-9]/g, '');
  if (phoneNumber.length < 10 || phoneNumber.length > 15) {
    return res.status(400).json({ success: false, message: 'Enter a valid phone number (country code + number, digits only).' });
  }

  // Atomic check-and-set: 'wx' fails with EEXIST if the lock is already
  // held, so two near-simultaneous requests can't both pass the guard —
  // reading reconnect-state.json first and writing second would leave a
  // window (the session middleware's own DB round-trip is enough to open
  // it) where both requests read "idle" before either writes "starting".
  try {
    fs.writeFileSync(LOCK_FILE, new Date().toISOString(), { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ success: false, message: 'A reconnect is already in progress.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to pause the scheduler: ' + err.message });
  }

  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  } catch (err) {
    clearLock();
    return res.status(500).json({ success: false, message: 'Failed to clear the old session: ' + err.message });
  }

  writeState({
    state: 'starting',
    phoneNumber,
    startedAt: new Date().toISOString(),
    pairingCode: null,
    error: null,
    exitCode: null,
  });

  const child = spawn('xvfb-run', ['-a', 'node', 'pair-link.js', phoneNumber], {
    cwd: CF_DIR,
    detached: true,
  });
  writeState({ pid: child.pid, state: 'awaiting-code' });

  const finish = (patch) => {
    writeState(patch);
    clearLock();
  };

  child.stdout.on('data', (data) => {
    const text = data.toString();
    const codeMatch = text.match(/PAIRING CODE:\s*([A-Z0-9]{6,10})/);
    if (codeMatch) {
      writeState({ state: 'code-ready', pairingCode: codeMatch[1], codeIssuedAt: new Date().toISOString() });
    }
    if (/✅ LINKED! Session saved/.test(text)) {
      finish({ state: 'linked', linkedAt: new Date().toISOString() });
      // pair-link.js keeps running after linking (waits for Ctrl+C) — stop it
      // now that the session is saved so the process doesn't linger.
      setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }, 2000);
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    if (/Missing or invalid phone number/.test(text)) {
      finish({ state: 'failed', error: 'Invalid phone number.' });
    }
    if (/Failed to request pairing code/.test(text)) {
      finish({ state: 'failed', error: text.trim().slice(-300) });
    }
  });

  child.on('exit', (code) => {
    const state = readState();
    if (state.state !== 'linked' && state.state !== 'cancelled') {
      finish({ state: code === 1 && state.state === 'code-ready' ? 'timeout' : 'failed', exitCode: code });
    } else {
      clearLock();
    }
  });

  child.on('error', (err) => {
    finish({ state: 'failed', error: err.message });
  });

  res.json({ success: true, message: 'Reconnect started.' });
});

// GET /api/admin/whatsapp/reconnect/status
router.get('/reconnect/status', (req, res) => {
  releaseStaleLockIfAny();
  res.json({ success: true, ...readState() });
});

// POST /api/admin/whatsapp/reconnect/cancel
router.post('/reconnect/cancel', (req, res) => {
  const state = readState();
  if (state.pid) {
    // Signal by PID (OS-level), not by holding a ChildProcess reference —
    // the cancel request may land on a different cluster worker than the
    // one that spawned the process.
    try { process.kill(-state.pid, 'SIGTERM'); } catch {}
    try { process.kill(state.pid, 'SIGTERM'); } catch {}
  }
  clearLock();
  writeState({ state: 'cancelled', cancelledAt: new Date().toISOString() });
  res.json({ success: true });
});

module.exports = router;
