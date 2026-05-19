const express = require('express');
const router  = express.Router();

async function getBrowser() {
  if (getBrowser._b) { try { await getBrowser._b.version(); return getBrowser._b; } catch(e) { getBrowser._b = null; } }
  const mod = await import('puppeteer');
  const p   = mod.default || mod;
  getBrowser._b = await p.launch({
    executablePath: p.executablePath(),
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });
  getBrowser._b.on('disconnected', () => { getBrowser._b = null; });
  console.log('[PDF] Browser ready');
  return getBrowser._b;
}

router.post('/api/resume/pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: 'No HTML provided' });
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdfBuffer = await page.pdf({
      format: 'A4', printBackground: true, preferCSSPageSize: true,
      margin: { right: 0, bottom: 0, left: 0 },
    });
    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const safe = (filename||'Gulf-Resume').replace(/[^a-zA-Z0-9\-_]/g,'_');
    res.writeHead(200, { 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="${safe}.pdf"`, 'Content-Length': buf.length, 'Cache-Control':'no-cache' });
    res.end(buf);
  } catch(err) {
    console.error('[PDF]', err.message);
    res.status(500).json({ error: err.message });
  } finally { if (page) try { await page.close(); } catch(e) {} }
});

router.get('/api/resume/pdf/status', (req, res) => res.json({ browser: getBrowser._b ? 'running' : 'stopped' }));
module.exports = router;
