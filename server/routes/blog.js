/* ══════════════════════════════════════════════════════════════
   server/routes/blog.js
   Public + Admin API for dynamic blog articles
══════════════════════════════════════════════════════════════ */
const express     = require('express');
const router      = express.Router();
const multer      = require('multer');
const path        = require('path');
const fs          = require('fs');
const db          = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

/* ── Image upload (blog featured images) ──────────────────── */
const blogImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads/blog');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `blog-${Date.now()}${ext}`);
  }
});
const blogUpload = multer({
  storage: blogImgStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════ */

/* GET /api/blog — list published articles */
router.get('/api/blog', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(50, parseInt(req.query.limit) || 12);
    const offset   = (page - 1) * limit;
    const category = req.query.category || '';
    const search   = req.query.search   || '';

    let where = 'WHERE status = "published"';
    const params = [];

    if (category) { where += ' AND category = ?'; params.push(category); }
    if (search)   { where += ' AND (title LIKE ? OR excerpt LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM blog_articles ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT id, title, slug, excerpt, featured_image, category, tags,
              author, reading_time, views, published_at, created_at
       FROM blog_articles ${where}
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, articles: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[Blog API]', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* GET /api/blog/categories — list categories with counts */
router.get('/api/blog/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT category, COUNT(*) AS count
       FROM blog_articles WHERE status = 'published'
       GROUP BY category ORDER BY count DESC`
    );
    res.json({ success: true, categories: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* GET /api/blog/:slug — single article */
router.get('/api/blog/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM blog_articles WHERE slug = ? AND status = 'published' LIMIT 1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    // Increment view count (fire and forget)
    db.query('UPDATE blog_articles SET views = views + 1 WHERE id = ?', [rows[0].id]).catch(() => {});

    // Related articles (same category, exclude current)
    const [related] = await db.query(
      `SELECT id, title, slug, excerpt, featured_image, category, reading_time, published_at
       FROM blog_articles
       WHERE status = 'published' AND category = ? AND slug != ?
       ORDER BY published_at DESC LIMIT 3`,
      [rows[0].category, req.params.slug]
    );

    res.json({ success: true, article: rows[0], related });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN ROUTES (protected)
══════════════════════════════════════════════════════════════ */

/* GET /api/admin/blog — all articles including drafts */
router.get('/api/admin/blog', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, slug, category, status, author, views, created_at, published_at
       FROM blog_articles ORDER BY created_at DESC`
    );
    res.json({ success: true, articles: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* GET /api/admin/blog/:id — single article for editing */
router.get('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM blog_articles WHERE id = ? LIMIT 1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, article: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* POST /api/admin/blog — create article */
router.post('/api/admin/blog', requireAdmin, async (req, res) => {
  try {
    const {
      title, content, excerpt, category, tags, author,
      reading_time, status, meta_title, meta_description,
      featured_image
    } = req.body;

    if (!title || !content) return res.status(400).json({ success: false, error: 'Title and content required' });

    // Auto-generate slug
    const slugify = (str) => str.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

    let slug = slugify(title);
    // Ensure unique slug
    const [existing] = await db.query('SELECT id FROM blog_articles WHERE slug LIKE ? LIMIT 5', [`${slug}%`]);
    if (existing.length) slug = `${slug}-${Date.now()}`;

    // Auto-calculate reading time if not provided
    const words = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
    const rt = reading_time || Math.max(1, Math.round(words / 200));

    const publishedAt = status === 'published' ? new Date() : null;

    await db.query(
      `INSERT INTO blog_articles
       (title, slug, content, excerpt, featured_image, category, tags, author,
        reading_time, status, meta_title, meta_description, published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title, slug, content, excerpt || '', featured_image || null,
       category || 'General', tags || '', author || 'JobOrbit Team',
       rt, status || 'draft',
       meta_title || title, meta_description || excerpt || '',
       publishedAt]
    );

    res.json({ success: true, slug, message: 'Article created' });
  } catch (err) {
    console.error('[Blog Create]', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* PUT /api/admin/blog/:id — update article */
router.put('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try {
    const {
      title, content, excerpt, category, tags, author,
      reading_time, status, meta_title, meta_description, featured_image
    } = req.body;

    const [existing] = await db.query(
      'SELECT id, status FROM blog_articles WHERE id = ? LIMIT 1', [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ success: false, error: 'Not found' });

    const words = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
    const rt = reading_time || Math.max(1, Math.round(words / 200));

    // Set published_at only when first publishing
    let publishedAtSQL = '';
    const params = [title, content, excerpt, featured_image || null, category,
                    tags, author, rt, status, meta_title || title,
                    meta_description || excerpt || ''];

    if (status === 'published' && existing[0].status === 'draft') {
      publishedAtSQL = ', published_at = NOW()';
    }

    await db.query(
      `UPDATE blog_articles SET
        title=?, content=?, excerpt=?, featured_image=?, category=?, tags=?,
        author=?, reading_time=?, status=?, meta_title=?, meta_description=?
        ${publishedAtSQL}
       WHERE id=?`,
      [...params, req.params.id]
    );

    res.json({ success: true, message: 'Article updated' });
  } catch (err) {
    console.error('[Blog Update]', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* DELETE /api/admin/blog/:id */
router.delete('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM blog_articles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Article deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* POST /api/admin/blog/upload-image — featured image upload */
router.post('/api/admin/blog/upload-image', requireAdmin, blogUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
  res.json({ success: true, url: `/uploads/blog/${req.file.filename}` });
});

/* POST /api/admin/blog/generate-image — Unsplash 5 options */
router.post('/api/admin/blog/generate-image', requireAdmin, async (req, res) => {
  const title = req.body.title || '';
  const excerpt = req.body.excerpt || '';
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(500).json({ success: false, error: 'UNSPLASH_ACCESS_KEY not set' });
  try {
    const text = (title + ' ' + excerpt).toLowerCase();
    let query = 'professional business office';
    if (text.match(/aramco|oil|petroleum|gas|refin|drill/)) query = 'oil refinery energy industrial';
    else if (text.match(/nurs|hospital|doctor|medical|health|clinic|patient/)) query = 'hospital healthcare medical professional';
    else if (text.match(/engineer|civil|mechanical|structural|construction|infrastructure/)) query = 'construction engineering infrastructure project';
    else if (text.match(/salary|pay|wage|income|earn|eosb|gratuity|compens/)) query = 'salary finance money professional';
    else if (text.match(/resume|cv|curriculum/)) query = 'resume career job application';
    else if (text.match(/interview|hiring|recruit|hire/)) query = 'job interview hiring professional';
    else if (text.match(/visa|iqama|permit|residency|passport|expat/)) query = 'passport visa travel documents';
    else if (text.match(/linkedin|networking|social media/)) query = 'professional networking business connection';
    else if (text.match(/bank|financ|invest|cfa|accounting|audit/)) query = 'banking finance investment';
    else if (text.match(/hse|safety|nebosh|osha|hazard|accident/)) query = 'safety construction worker hard hat';
    else if (text.match(/remote|hybrid|work from home|digital nomad/)) query = 'remote work laptop home office';
    else if (text.match(/woman|women|female|gender/)) query = 'businesswoman professional career';
    else if (text.match(/neom|megaproject|giga|futur/)) query = 'futuristic city modern architecture';
    else if (text.match(/cost|living|rent|apartment|city|riyadh|jeddah|dammam/)) query = 'modern city apartment urban living';
    else if (text.match(/scam|fraud|fake|protect|warn/)) query = 'cybersecurity protection professional';
    else if (text.match(/graduat|fresh|entry|junior|first job/)) query = 'graduate career start young professional';
    else if (text.match(/promot|growth|career|advance|leader|manag/)) query = 'career growth leadership success';
    else if (text.match(/ramadan|cultur|religio|prayer|mosque/)) query = 'culture workplace diversity professional';
    else if (text.match(/driv|car|transport|licen/)) query = 'city highway driving modern';
    else if (text.match(/saudi|gulf|riyadh|jeddah|ksa|arab/)) query = 'Saudi Arabia Gulf business professional';
    else if (text.match(/job|career|work|employ|opportun/)) query = 'career job professional office';
    else if (text.match(/certif|qualif|training|course|skill/)) query = 'professional certification training education';
    else if (text.match(/negoti|offer|package|benefit/)) query = 'business negotiation deal handshake';
    else if (text.match(/tech|it|software|digital|cyber|cloud|data|ai/)) query = 'technology software developer coding';
    if (req.body.customSearch && req.body.customSearch.trim()) query = req.body.customSearch.trim();
    if (req.body.customSearch && req.body.customSearch.trim()) query = req.body.customSearch.trim();

    const url = 'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(query) + '&per_page=5&orientation=landscape&client_id=' + key;
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok || !d.results || !d.results.length) return res.status(500).json({ success: false, error: 'No photos found for: ' + query });

    const photos = d.results.map(function(p) {
      return {
        id: p.id,
        thumb: p.urls.small,
        full: p.urls.regular,
        attribution: 'Photo by ' + p.user.name + ' on Unsplash',
        attributionLink: p.links.html,
        downloadLocation: p.links.download_location
      };
    });

    res.json({ success: true, photos, query });
  } catch (err) {
    console.error('[Unsplash]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* POST /api/admin/blog/select-image — download chosen Unsplash photo */
router.post('/api/admin/blog/select-image', requireAdmin, async (req, res) => {
  const { photoUrl, downloadLocation, attribution, attributionLink } = req.body;
  const key = process.env.UNSPLASH_ACCESS_KEY;
  try {
    fetch(downloadLocation + '?client_id=' + key).catch(() => {});
    const imgRes = await fetch(photoUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const filename = 'blog-unsplash-' + Date.now() + '.jpg';
    const dir = require('path').join(__dirname, '../../public/uploads/blog');
    require('fs').mkdirSync(dir, { recursive: true });
    require('fs').writeFileSync(require('path').join(dir, filename), buf);
    res.json({ success: true, url: '/uploads/blog/' + filename, attribution, attributionLink });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
