/* ══════════════════════════════════════════════════════════════
   routes/pdf.js — Production-ready PDF generation
   
   Architecture:
   • Singleton browser — Chromium launches once, stays alive
   • Concurrency queue — max 3 PDFs generate simultaneously
   • Request queue    — up to 20 requests wait in line
   • Overflow guard   — 503 if queue is full (not a crash)
   • Auto-recovery    — browser restarts if it crashes
   • Timeout          — requests don't hang forever (25s max)
   
   Install on VPS:    npm install puppeteer
   Install on Termux: pkg install chromium && npm install puppeteer-core
══════════════════════════════════════════════════════════════ */
const express      = require('express');
const router       = express.Router();
const { execSync } = require('child_process');

/* ── Environment detection ───────────────────────────────── */
function getChromiumPath() {
  const candidates = [
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  for (const p of candidates) {
    try { execSync(`test -f "${p}"`); return p; } catch(e) {}
  }
  return null; // Let full puppeteer use its bundled Chromium
}

function getPuppeteer() {
  try { return require('puppeteer-core'); } catch(e) {}
  try { return require('puppeteer');      } catch(e) {}
  throw new Error('Run: npm install puppeteer');
}

/* ── Singleton browser ───────────────────────────────────── */
let browser = null;

async function getBrowser() {
  if (browser) {
    try { await browser.version(); return browser; }
    catch(e) { browser = null; }
  }

  const puppeteer      = getPuppeteer();
  const executablePath = getChromiumPath();
  const opts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  };
  if (executablePath) opts.executablePath = executablePath;

  browser = await puppeteer.launch(opts);
  browser.on('disconnected', () => {
    browser = null;
    console.log('[PDF] Browser disconnected — will restart on next request');
  });

  console.log('[PDF] Browser started —', executablePath || 'bundled Chromium');
  return browser;
}

/* ── Concurrency queue ───────────────────────────────────── */
const MAX_CONCURRENT = 3;   // PDFs generating at the same time
const MAX_QUEUED     = 20;  // Requests waiting in line
const TIMEOUT_MS     = 25000;

let active = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENT) {
      active++;
      return resolve();
    }
    if (waitQueue.length >= MAX_QUEUED) {
      return reject(new Error('PDF service is busy — please try again in a moment.'));
    }
    // Add timeout so requests don't wait forever
    const timer = setTimeout(() => {
      const idx = waitQueue.findIndex(w => w.resolve === resolve);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error('PDF request timed out — please try again.'));
    }, TIMEOUT_MS);

    waitQueue.push({
      resolve: () => { clearTimeout(timer); active++; resolve(); },
      reject,
    });
  });
}

function releaseSlot() {
  active = Math.max(0, active - 1);
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    next.resolve();
  }
}

/* ── Route ───────────────────────────────────────────────── */
router.post('/api/resume/pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: 'No HTML provided' });

  // Queue status header — useful for monitoring
  res.setHeader('X-PDF-Queue', `active=${active} waiting=${waitQueue.length}`);

  let slotAcquired = false;
  let page;

  try {
    // Wait for a free slot (or reject if overloaded)
    await acquireSlot();
    slotAcquired = true;

    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format:            'A4',
      printBackground:   true,
      preferCSSPageSize: true,
      margin:            { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const safeName = (filename || 'Gulf-Resume').replace(/[^a-zA-Z0-9\-_]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    const isOverload = err.message.includes('busy') || err.message.includes('timed out');
    console.error('[PDF Route]', err.message);
    res.status(isOverload ? 503 : 500).json({ error: err.message });
  } finally {
    if (page)         { try { await page.close(); } catch(e) {} }
    if (slotAcquired) { releaseSlot(); }
  }
});

/* ── Health check (optional — useful for monitoring) ─────── */
router.get('/api/resume/pdf/status', (req, res) => {
  res.json({
    browser:  browser ? 'running' : 'stopped',
    active,
    queued:   waitQueue.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueued:     MAX_QUEUED,
  });
});

module.exports = router;
