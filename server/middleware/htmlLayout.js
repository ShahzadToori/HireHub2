/* ══════════════════════════════════════════════════════════════
   server/middleware/htmlLayout.js
   Injects navbar + footer into every HTML page at request time.
   Edit public/partials/navbar.html or footer.html once
   → all pages update instantly with no server restart needed.
══════════════════════════════════════════════════════════════ */
const fs   = require('fs');
const path = require('path');

const PUBLIC_DIR   = path.join(__dirname, '../../public');
const PARTIALS_DIR = path.join(PUBLIC_DIR, 'partials');

// ── Load partials into memory cache ──────────────────────────
const cache = { navbar: '', footer: '' };

function loadPartial(name) {
  try {
    cache[name] = fs.readFileSync(path.join(PARTIALS_DIR, `${name}.html`), 'utf8');
    console.log(`[Layout] Loaded: ${name}.html`);
  } catch(e) {
    console.warn(`[Layout] Could not load partial "${name}": ${e.message}`);
  }
}

loadPartial('navbar');
loadPartial('footer');

// Auto-reload partials when they change — no server restart needed
fs.watch(PARTIALS_DIR, (event, filename) => {
  if (filename && filename.endsWith('.html')) {
    const name = filename.replace('.html', '');
    if (cache[name] !== undefined) {
      loadPartial(name);
    }
  }
});

// ── Inject placeholders in HTML string ───────────────────────
function inject(html) {
  return html
    .replace(/<!--\s*NAVBAR\s*-->/g, cache.navbar)
    .replace(/<!--\s*FOOTER\s*-->/g, cache.footer);
}

// ── Middleware ────────────────────────────────────────────────
function htmlLayoutMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();

  const urlPath = req.path;

  // Determine candidate file paths to try
  const candidates = [];

  if (urlPath === '/') {
    candidates.push(path.join(PUBLIC_DIR, 'index.html'));
  } else if (urlPath.endsWith('.html')) {
    candidates.push(path.join(PUBLIC_DIR, urlPath));
  } else if (urlPath.endsWith('/')) {
    candidates.push(path.join(PUBLIC_DIR, urlPath, 'index.html'));
  } else {
    // e.g. /blog → try /blog/index.html, then /blog.html
    candidates.push(path.join(PUBLIC_DIR, urlPath, 'index.html'));
    candidates.push(path.join(PUBLIC_DIR, urlPath + '.html'));
  }

  // Security: prevent path traversal
  const safeCandidates = candidates.filter(p => p.startsWith(PUBLIC_DIR));
  if (!safeCandidates.length) return next();

  // Try each candidate in order
  function tryNext(i) {
    if (i >= safeCandidates.length) return next();
    fs.readFile(safeCandidates[i], 'utf8', (err, html) => {
      if (err) return tryNext(i + 1);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(inject(html));
    });
  }
  tryNext(0);
}

htmlLayoutMiddleware.inject = inject;
module.exports = htmlLayoutMiddleware;
