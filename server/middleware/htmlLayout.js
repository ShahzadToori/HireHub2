/* ══════════════════════════════════════════════════════════════
   server/middleware/htmlLayout.js
   Injects navbar + footer into every HTML page at request time.
   Edit public/partials/navbar.html or footer.html once
   → all pages update instantly with no server restart needed.
══════════════════════════════════════════════════════════════ */
const fs   = require('fs');
const path = require('path');
const db   = require('../db/connection');

const PUBLIC_DIR   = path.join(__dirname, '../../public');
const PARTIALS_DIR = path.join(PUBLIC_DIR, 'partials');

// ── Load partials into memory cache ──────────────────────────
const cache = { navbar: '', footer: '', 'apply-form': '' };

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
loadPartial('apply-form');

// ── Per-page meta tag cache (refreshed every 5 min) ──────────
const PAGE_META_KEYS = {
  '/':                     'meta_home',
  '/index.html':           'meta_home',
  '/about.html':           'meta_about',
  '/blog/':                'meta_blog',
  '/blog/index.html':      'meta_blog',
  '/tools/':               'meta_tools',
  '/tools/index.html':     'meta_tools',
  '/feedback.html':        'meta_feedback',
  '/privacy-policy.html':  'meta_privacy',
  '/terms.html':           'meta_terms',
  '/disclaimer.html':      'meta_disclaimer',
};

let _metaCache = {};
let _metaCacheAt = 0;
const META_TTL = 300000; // 5 min

async function loadMetaCache() {
  try {
    const [rows] = await db.query(
      "SELECT \`key\`, \`value\` FROM settings WHERE \`key\` LIKE 'meta_%' OR \`key\` IN ('ga4_id','og_image','site_url','bing_verify','twitter_handle')"
    );
    const c = {};
    rows.forEach(r => { c[r.key] = r.value; });
    _metaCache = c;
    _metaCacheAt = Date.now();
  } catch(e) {
    console.warn('[Layout] Meta cache load failed:', e.message);
  }
}
loadMetaCache();

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function injectMeta(html, urlPath) {
  const key = PAGE_META_KEYS[urlPath];
  if (!key) return html;
  const title = (_metaCache[key + '_title'] || '').trim();
  const desc  = (_metaCache[key + '_desc']  || '').trim();
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
  }
  if (desc) {
    if (/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(/<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${esc(desc)}">`);
    } else {
      html = html.replace(/<\/title>/i,
        `</title>\n  <meta name="description" content="${esc(desc)}">`);
    }
  }
  // Mirror custom title → og:title + twitter:title
  if (title) {
    html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i,
      `<meta property="og:title" content="${esc(title)}">`);
    html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i,
      `<meta name="twitter:title" content="${esc(title)}">`);
  }
  // Mirror custom description → og:description + twitter:description
  if (desc) {
    html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i,
      `<meta property="og:description" content="${esc(desc)}">`);
    html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i,
      `<meta name="twitter:description" content="${esc(desc)}">`);
  }
  // Per-page OG image (falls back to site-wide og_image)
  const _ogImg = (_metaCache[key + '_og_image'] || _metaCache['og_image'] || '').trim();
  if (_ogImg) {
    if (/<meta\s+property=["']og:image["']/i.test(html)) {
      html = html.replace(/<meta\s+property=["']og:image["'][^>]*>/i,
        `<meta property="og:image" content="${esc(_ogImg)}">`);
    } else {
      html = html.replace('</head>', `  <meta property="og:image" content="${esc(_ogImg)}">
</head>`);
    }
  }
  // Fix og:url to full absolute URL
  const _su = (_metaCache['site_url'] || '').replace(/\/+$/, '');
  if (_su) {
    const _ogUrl = _su + (urlPath === '/' ? '/' : urlPath);
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${esc(_ogUrl)}">`);
  }
  return html;
}

// Unconditional — unlike injectMeta(), this runs on every HTML page served
// from public/ (including public/employer/*), regardless of PAGE_META_KEYS.
// GA4 used to live inside injectMeta() gated by PAGE_META_KEYS, which meant
// most pages (every blog article, every tool page, the whole employer
// portal) never got a tracking script at all — moved here so it always
// fires exactly once, sitewide, alongside the first-party beacon.
function injectAnalytics(html) {
  const ga4Id = (_metaCache['ga4_id'] || '').trim();
  const ga4Script = ga4Id
    ? `  <!-- Google Analytics 4 -->\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>\n`
    : '';

  // Server-rendered so real crawlers (Bing, Twitter — neither executes JS
  // the way Googlebot does) actually see these, unlike the old client-side
  // setMeta() calls in main.js which only ever reached JS-executing visitors.
  const bingVerify = (_metaCache['bing_verify'] || '').trim();
  const bingTag = bingVerify ? `  <meta name="msvalidate.01" content="${esc(bingVerify)}">\n` : '';

  const twitterHandle = (_metaCache['twitter_handle'] || '').trim();
  const twitterTag = twitterHandle ? `  <meta name="twitter:site" content="${esc(twitterHandle)}">\n` : '';

  return html.replace('</head>', `${ga4Script}${bingTag}${twitterTag}  <script src="/js/analytics.js" defer></script>\n</head>`);
}

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
    .replace(/<!--\s*FOOTER\s*-->/g, cache.footer)
    .replace(/<!--\s*APPLY_FORM\s*-->/g, cache['apply-form']);
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
      // Refresh meta cache if stale
      if (Date.now() - _metaCacheAt > META_TTL) loadMetaCache();
      const finalHtml = injectAnalytics(injectMeta(inject(html), urlPath));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(finalHtml);
    });
  }
  tryNext(0);
}

htmlLayoutMiddleware.inject           = inject;
htmlLayoutMiddleware.injectAnalytics  = injectAnalytics;
htmlLayoutMiddleware.reloadMeta       = loadMetaCache;
module.exports = htmlLayoutMiddleware;
