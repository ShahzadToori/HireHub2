/* ══════════════════════════════════════════════════════════════
   Add this to server/routes/seo.js (or a new middleware)
   Handles /blog/:slug → serves blog-article.html
   Handles /blog/ and /blog → serves blog-index.html
   Add BEFORE app.use(express.static(...)) in server.js
══════════════════════════════════════════════════════════════ */
const express   = require('express');
const router    = express.Router();
const path      = require('path');
const fs        = require('fs');
const db        = require('../db/connection');
const htmlLayout = require('../middleware/htmlLayout');

const PUBLIC_DIR = path.join(__dirname, '../../public');

// /blog → /blog/
router.get('/blog', (req, res) => res.redirect(301, '/blog/'));

// /blog/ → blog index
router.get('/blog/', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'blog', 'index.html');
  if (fs.existsSync(file)) res.sendFile(file);
  else res.status(404).send('Blog not found');
});

// /blog/:slug → article page
router.get('/blog/:slug', async (req, res) => {
  const slug = req.params.slug;
  // Skip static files (old HTML articles still in /blog/)
  if (slug.endsWith('.html') || slug.includes('.')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'blog', slug), err => {
      if (err) res.status(404).send('Not found');
    });
  }
  // SSR: inject real meta tags from DB before serving article.html
  try {
    const [[article]] = await db.query(
      "SELECT title,slug,excerpt,content,featured_image,meta_title,meta_description,"
      + "author,reading_time,category,published_at "
      + "FROM blog_articles WHERE slug=? AND status='published' LIMIT 1",
      [slug]
    );

    if (!article) {
      try {
        const html = fs.readFileSync(path.join(PUBLIC_DIR, 'blog', 'article.html'), 'utf8');
        return res.status(404).send(htmlLayout.injectAnalytics(htmlLayout.inject(html)));
      } catch (e) {
        return res.status(404).send('Article not found');
      }
    }

    // Increment view count async (don't block response)
    db.query('UPDATE blog_articles SET views=views+1 WHERE slug=?', [slug]).catch(() => {});

    // Load site settings for canonical + page title format
    const [settingsRows] = await db.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('site_url','site_name','meta_title_format')"
    );
    const settingsMap = {};
    settingsRows.forEach(r => { settingsMap[r.key] = r.value; });
    const siteUrl  = settingsMap.site_url  || 'https://joborbit.org';
    const siteName = settingsMap.site_name || 'JobOrbit';
    const titleFmt = settingsMap.meta_title_format || '';

    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const title     = article.meta_title        || article.title;
    const desc      = article.meta_description  || article.excerpt || '';
    const canonical = `${siteUrl}/blog/${article.slug}`;
    const ogImage   = article.featured_image    || `${siteUrl}/uploads/logo-1772305890056.svg`;
    const pubDate   = article.published_at ? new Date(article.published_at).toISOString() : '';

    // <title> tag only — og:title/twitter:title/JSON-LD headline stay as
    // the clean article title below; only the browser-tab/SERP title gets
    // the site-wide format applied, same as job pages already do.
    const pageTitle = titleFmt
      ? titleFmt.replace('{title}', title).replace('{company}', '').replace('{site}', siteName)
      : `${title} – ${siteName} Blog`;

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'BlogPosting',
      headline:   title,
      description: desc,
      image:      ogImage,
      datePublished: pubDate,
      author:     { '@type': 'Organization', name: 'JobOrbit' },
      publisher:  { '@type': 'Organization', name: 'JobOrbit', url: siteUrl },
      url:        canonical
    });

    let html = fs.readFileSync(path.join(PUBLIC_DIR, 'blog', 'article.html'), 'utf8');

    html = html
      .replace('<title id="page-title">Article \u2013 JobOrbit Blog</title>',
               `<title id="page-title">${esc(pageTitle)}</title>`)
      .replace('<meta name="description" id="page-desc" content="">',
               `<meta name="description" id="page-desc" content="${esc(desc)}">`)
      .replace('<meta property="og:title" id="og-title" content="">',
               `<meta property="og:title" id="og-title" content="${esc(title)}">`)
      .replace('<meta property="og:description" id="og-desc" content="">',
               `<meta property="og:description" id="og-desc" content="${esc(desc)}">`)
      .replace('<meta property="og:image" id="og-image" content="">',
               `<meta property="og:image" id="og-image" content="${esc(ogImage)}">`)
      .replace('<link rel="canonical" id="page-canonical" href="">',
               `<link rel="canonical" id="page-canonical" href="${esc(canonical)}">`)
      .replace('</head>',
               `<script type="application/ld+json">${jsonLd}</script>\n</head>`);

    html = htmlLayout.injectAnalytics(htmlLayout.inject(html));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.send(html);
  } catch(e) {
    console.error('[Blog SSR]', e.message);
    try {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, 'blog', 'article.html'), 'utf8');
      res.status(500).send(htmlLayout.injectAnalytics(htmlLayout.inject(html)));
    } catch (e2) {
      res.status(500).send('Server error');
    }
  }
});

module.exports = router;
