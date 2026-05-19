/* ══════════════════════════════════════════════════════════════
   Add this to server/routes/seo.js (or a new middleware)
   Handles /blog/:slug → serves blog-article.html
   Handles /blog/ and /blog → serves blog-index.html
   Add BEFORE app.use(express.static(...)) in server.js
══════════════════════════════════════════════════════════════ */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');

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
  // Serve dynamic article page
  res.sendFile(path.join(PUBLIC_DIR, 'blog', 'article.html'), err => {
    if (err) res.status(404).send('Article not found');
  });
});

module.exports = router;
