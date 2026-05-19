/* ══════════════════════════════════════════════════════════════
   routes/pdf.js — Production-ready PDF generation
   Uses dynamic import() for ESM-only puppeteer v22+
══════════════════════════════════════════════════════════════ */
const express = require('express');
const router  = express.Router();

/* ── Detect puppeteer + correct Chromium path ────────────── */
async function getPuppeteerAndPath() {
  // Full puppeteer (VPS) — ESM module, must use dynamic import()
  try {
    const mod = await import('puppeteer');
    const p   = mod.default || mod;
    return { puppeteer: p, executablePath: p.executablePath() };
  } catch(e) {}

  // puppeteer-core (Termux) — also ESM
  try {
    const { execSync } = require('child_process');
    const mod = await import('puppeteer-core');
    const p   = mod.default || mod;
    const candidates = [
      '/data/data/com.termux/files/usr/bin/chromium-browser',
      '/data/data/com.termux/files/usr/bin/chromium',
    ];
    for (const c of candidates) {
      try { execSync(`test -f "${c}"`); return { puppeteer: p, executablePath: c }; } catch(e) {}
    }
    throw new Error('Chromium not found on Termux. Run: pkg install chromium');
  } catch(e) { throw e; }
}

/* ── Singleton browser ───────────────────────────────────── */
let browser = null;

async function getBrowser() {
  if (browser) {
    try { await browser.version(); return browser; }
    catch(e) { browser = null; }
  }

  const { puppeteer, executablePath } = await getPuppeteerAndPath();

  browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  browser.on('disconnected', () => {
    browser = null;
    console.log('[PDF] Browser disconnected — will restart on next request');
  });

  console.log('[PDF] Browser started —', executablePath);
  return browser;
}

/* ── Concurrency queue ───────────────────────────────────── */
const MAX_CONCURRENT = 3;
const MAX_QUEUED     = 20;
const TIMEOUT_MS     = 25000;

let active = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENT) { active++; return resolve(); }
    if (waitQueue.length >= MAX_QUEUED) {
      return reject(new Error('PDF service is busy — please try again in a moment.'));
    }
    const timer = setTimeout(() => {
      const idx = waitQueue.findIndex(w => w.resolve === resolve);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error('PDF request timed out — please try again.'));
    }, TIMEOUT_MS);
    waitQueue.push({ resolve: () => { clearTimeout(timer); active++; resolve(); }, reject });
  });
}

function releaseSlot() {
  active = Math.max(0, active - 1);
  if (waitQueue.length > 0) waitQueue.shift().resolve();
}

/* ── Route ───────────────────────────────────────────────── */
router.post('/api/resume/pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: 'No HTML provided' });

  res.setHeader('X-PDF-Queue', `active=${active} waiting=${waitQueue.length}`);
  let slotAcquired = false;
  let page;

  try {
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

    const buf      = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const safeName = (filename || 'Gulf-Resume').replace(/[^a-zA-Z0-9\-_]/g, '_');
    res.writeHead(200, {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Content-Length':      buf.length,
      'Cache-Control':       'no-cache',
    });
    res.end(buf);

  } catch (err) {
    const isOverload = err.message.includes('busy') || err.message.includes('timed out');
    console.error('[PDF Route]', err.message);
    res.status(isOverload ? 503 : 500).json({ error: err.message });
  } finally {
    if (page)         { try { await page.close(); } catch(e) {} }
    if (slotAcquired) { releaseSlot(); }
  }
});

/* ── Status check ────────────────────────────────────────── */
router.get('/api/resume/pdf/status', (req, res) => {
  res.json({ browser: browser ? 'running' : 'stopped', active, queued: waitQueue.length, maxConcurrent: MAX_CONCURRENT, maxQueued: MAX_QUEUED });
});

module.exports = router;
