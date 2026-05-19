/* ══════════════════════════════════════════════════════════════
   routes/pdf.js — Server-side PDF via puppeteer-core
   Uses Termux system Chromium instead of bundled browser.
   Install: pkg install chromium && npm install puppeteer-core
══════════════════════════════════════════════════════════════ */
const express        = require('express');
const router         = express.Router();
const puppeteer      = require('puppeteer-core');
const { execSync }   = require('child_process');

// Auto-detect Chromium path on Termux / Linux
function getChromiumPath() {
  const candidates = [
    '/data/data/com.termux/files/usr/bin/chromium-browser', // Termux
    '/data/data/com.termux/files/usr/bin/chromium',         // Termux alt
    '/usr/bin/chromium-browser',                             // Debian/Ubuntu
    '/usr/bin/chromium',                                     // Arch/Alpine
    '/usr/bin/google-chrome',                                // Chrome Linux
    '/usr/bin/google-chrome-stable',
  ];
  for (const p of candidates) {
    try { execSync(`test -f ${p}`); return p; } catch(e) {}
  }
  return null;
}

router.post('/api/resume/pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: 'No HTML provided' });

  const executablePath = getChromiumPath();
  if (!executablePath) {
    return res.status(500).json({
      error: 'Chromium not found. Run: pkg install chromium'
    });
  }

  let browser;
  try {
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

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format:            'A4',
      printBackground:   true,
      preferCSSPageSize: true,
      margin:            { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const safeName = (filename || 'Gulf-Resume')
      .replace(/[^a-zA-Z0-9\-_]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('[PDF Route] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch(e) {} }
  }
});

module.exports = router;
