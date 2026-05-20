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

/* POST /api/admin/blog/generate-image — Pollinations AI */
router.post('/api/admin/blog/generate-image', requireAdmin, async (req, res) => {
  const title = req.body.title;
  if (!title) return res.status(400).json({ success: false, error: 'Title required' });
  try {
    const prompt = encodeURIComponent('Professional blog header, ' + title + ', Gulf Saudi Arabia, modern business, photorealistic, no text, no watermark');
    const url = 'https://image.pollinations.ai/prompt/' + prompt + '?width=1200&height=630&nologo=true&model=flux';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    const imgRes = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!imgRes.ok) return res.status(500).json({ success: false, error: 'Generation failed: ' + imgRes.status });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const filename = 'blog-ai-' + Date.now() + '.jpg';
    const dir = require('path').join(__dirname, '../../public/uploads/blog');
    require('fs').mkdirSync(dir, { recursive: true });
    require('fs').writeFileSync(require('path').join(dir, filename), buf);
    res.json({ success: true, url: '/uploads/blog/' + filename });
  } catch (err) {
    console.error('[AI Image]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
