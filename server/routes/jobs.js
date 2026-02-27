const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

// Helper – safe integer
const intOr = (v, def) => {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
};

// GET /api/jobs  – public listing with search/filter/pagination
router.get('/', async (req, res) => {
  try {
    const {
      q,             // keyword
      category,      // category slug or id
      location,      // location text
      type,          // job_type
      sort = 'newest',
      page = 1,
      limit = 12,
      featured       // '1' to show only featured
    } = req.query;

    const perPage = Math.min(intOr(limit, 12), 50);
    const offset  = (intOr(page, 1) - 1) * perPage;

    let where  = ["j.status = 'active'"];
    let params = [];

    if (q) {
      where.push('MATCH(j.title, j.company, j.description) AGAINST(? IN BOOLEAN MODE)');
      params.push(`${q}*`);
    }
    if (category) {
      where.push('(c.slug = ? OR c.id = ?)');
      params.push(category, category);
    }
    if (location) {
      where.push('j.location LIKE ?');
      params.push(`%${location}%`);
    }
    if (type) {
      where.push('j.job_type = ?');
      params.push(type);
    }
    if (featured === '1') {
      where.push('j.featured = 1 AND (j.featured_until IS NULL OR j.featured_until >= CURDATE())');
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const orderMap = {
      newest: 'j.created_at DESC',
      oldest: 'j.created_at ASC',
      title:  'j.title ASC'
    };
    const orderSql = orderMap[sort] || 'j.created_at DESC';

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
       ${whereSql}`,
      params
    );

    const [jobs] = await db.execute(
      `SELECT j.id, j.title, j.company, j.location, j.job_type,
              j.description, j.phone, j.whatsapp, j.email, j.map_link, j.extra_fields,
              j.featured, j.sponsored, j.slug, j.created_at, j.views,
              c.name AS category, c.slug AS category_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
       ${whereSql}
       ORDER BY j.sponsored DESC, j.featured DESC, ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    // Parse extra_fields JSON
    jobs.forEach(j => {
      try { j.extra_fields = j.extra_fields ? JSON.parse(j.extra_fields) : null; } catch { j.extra_fields = null; }
    });

    res.json({
      success: true,
      total,
      page:     intOr(page, 1),
      perPage,
      pages:    Math.ceil(total / perPage),
      jobs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/featured  – sponsored + featured jobs
router.get('/featured', async (req, res) => {
  try {
    const [jobs] = await db.execute(
      `SELECT j.id, j.title, j.company, j.location, j.job_type,
              j.description, j.phone, j.whatsapp, j.email, j.map_link, j.extra_fields,
              j.featured, j.sponsored, j.slug, j.created_at,
              c.name AS category, c.slug AS category_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.status = 'active'
          AND (j.featured = 1 OR j.sponsored = 1)
          AND (j.featured_until IS NULL OR j.featured_until >= CURDATE())
        ORDER BY j.sponsored DESC, j.created_at DESC
        LIMIT 6`
    );
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/categories
router.get('/categories', async (req, res) => {
  try {
    const [cats] = await db.execute(
      `SELECT c.id, c.name, c.slug, COUNT(j.id) AS count
         FROM categories c
         LEFT JOIN jobs j ON j.category_id = c.id AND j.status = 'active'
         GROUP BY c.id
         ORDER BY c.name`
    );
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/:slug  – single job detail
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT j.*, c.name AS category, c.slug AS category_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.slug = ? AND j.status = 'active'
        LIMIT 1`,
      [req.params.slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Parse extra_fields JSON
    try { rows[0].extra_fields = rows[0].extra_fields ? JSON.parse(rows[0].extra_fields) : null; } catch { rows[0].extra_fields = null; }

    // Increment views
    await db.execute('UPDATE jobs SET views = views + 1 WHERE id = ?', [rows[0].id]);

    res.json({ success: true, job: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
