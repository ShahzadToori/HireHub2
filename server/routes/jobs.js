const express = require('express');
const db      = require('../db/connection');
const { validate, z } = require('../middleware/validate');
const { publicFormLimiter } = require('../middleware/tieredRateLimit');
const router  = express.Router();

// Helper – safe integer
const intOr = (v, def) => {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
};

async function getSetting(key, fallback = '') {
  try {
    const [[row]] = await db.query('SELECT `value` FROM settings WHERE `key`=? LIMIT 1', [key]);
    return (row && row.value) ? row.value : fallback;
  } catch { return fallback; }
}

// SQL boolean expressions for "is this job currently a valid paid
// placement" — literal 0 (never true) when the site owner has switched the
// feature off entirely (Settings → Section Visibility), regardless of the
// job's own featured/sponsored flags; otherwise the existing per-job
// expiry check (featured_until / sponsored_until).
async function getPromotionSql() {
  const [showFeatured, showSponsored] = await Promise.all([
    getSetting('show_featured', '1'),
    getSetting('show_sponsored', '1')
  ]);
  // NOTE: must not be a bare integer literal like '0' — MySQL treats a
  // bare integer in ORDER BY as a positional column reference ("ORDER BY 0"
  // errors with "Unknown column '0'"), not a constant. (1=0) is unambiguous
  // in both WHERE and ORDER BY.
  return {
    featuredSql:  showFeatured  !== '0' ? '(j.featured = 1 AND (j.featured_until IS NULL OR j.featured_until >= CURDATE()))'   : '(1=0)',
    sponsoredSql: showSponsored !== '0' ? '(j.sponsored = 1 AND (j.sponsored_until IS NULL OR j.sponsored_until >= CURDATE()))' : '(1=0)'
  };
}

const digitsStr = (max) => z.string().regex(/^\d+$/).max(max);

const flagParam = () => z.enum(['0', '1']).optional().or(z.literal(''));

const searchSchema = z.object({
  q:        z.string().trim().max(100).optional().or(z.literal('')),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  location: z.string().trim().max(100).optional().or(z.literal('')),
  type:     z.string().trim().max(50).optional().or(z.literal('')),
  sort:     z.enum(['newest', 'oldest', 'title', 'salary_high']).optional().or(z.literal('')),
  page:     digitsStr(6).optional().or(z.literal('')),
  limit:    digitsStr(3).optional().or(z.literal('')),
  featured: flagParam(),
  salary:   z.string().trim().max(20).regex(/^\d+(-\d+)?\+?$/, 'Invalid salary filter').optional().or(z.literal('')),
  visa:     flagParam(),
  date:     digitsStr(4).optional().or(z.literal('')),
  iqama:     flagParam(),
  immediate: flagParam(),
  local:     flagParam(),
}).strict();

const jobSubmitSchema = z.object({
  title:       z.string().trim().min(1).max(200),
  company:     z.string().trim().min(1).max(200),
  location:    z.string().trim().min(1).max(200),
  job_type:    z.string().trim().max(50).optional(),
  description: z.string().trim().min(1).max(10000),
  phone:       z.string().trim().max(30).optional().or(z.literal('')),
  whatsapp:    z.string().trim().max(30).optional().or(z.literal('')),
  email:       z.union([z.string().trim().max(160).email(), z.literal('')]).optional(),
  category_id: z.union([z.string(), z.number()]).optional(),
  map_link:    z.union([z.string().trim().max(500).url(), z.literal('')]).optional(),
  salary:      z.string().trim().max(100).optional().or(z.literal('')),
}).strict().refine(
  data => data.email || data.phone || data.whatsapp,
  { message: 'Please provide at least one contact method (email, phone, or WhatsApp).', path: ['email'] }
);

// GET /api/jobs  – public listing with search/filter/pagination
router.get('/', validate(searchSchema, 'query'), async (req, res) => {
  try {
    const {
      q,
      category,
      location,
      type,
      sort     = 'newest',
      page     = 1,
      limit    = 12,
      featured,
      salary,   // Phase 1: e.g. "5000-10000" or "35000+"
      visa,     // Phase 1: "1" = visa sponsored only
      date      // Phase 1: days since posted e.g. "7" = last 7 days
    } = req.query;

    const perPage = Math.min(intOr(limit, 12), 50);
    const offset  = (intOr(page, 1) - 1) * perPage;

    const { featuredSql, sponsoredSql } = await getPromotionSql();

    let where  = ['j.status = "active"', '(j.employer_id IS NULL OR e.status = "active")'];
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
      where.push(featuredSql);
    }
    if (visa === '1') {
      where.push('j.visa_sponsored = 1');
    }
    if (date && !isNaN(parseInt(date))) {
      where.push('j.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)');
      params.push(parseInt(date));
    }
    if (salary) {
      if (salary.endsWith('+')) {
        const min = parseInt(salary);
        if (!isNaN(min)) { where.push('j.salary_min >= ?'); params.push(min); }
      } else if (salary.includes('-')) {
        const [mn, mx] = salary.split('-').map(Number);
        if (!isNaN(mn) && !isNaN(mx)) {
          where.push('(j.salary_min >= ? AND j.salary_min <= ?)');
          params.push(mn, mx);
        }
      }
    }

    if (req.query.iqama === "1") {
      where.push("(j.title LIKE ? OR j.description LIKE ?)");
      params.push("%transferable%", "%transferable%");
    }
    if (req.query.immediate === "1") {
      where.push("(j.title LIKE ? OR j.description LIKE ?)");
      params.push("%immediate%", "%immediate joining%");
    }
    if (req.query.local === "1") {
      where.push("(j.title LIKE ? OR j.description LIKE ?)");
      params.push("%local hire%", "%local hiring%");
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const orderMap = {
      newest:      'j.created_at DESC',
      oldest:      'j.created_at ASC',
      title:       'j.title ASC',
      salary_high: 'j.salary_min DESC'
    };
    const orderSql = orderMap[sort] || 'j.created_at DESC';

    // ── Single query with SQL_CALC_FOUND_ROWS — avoids second COUNT query ──
    const [jobs] = await db.query(
      `SELECT SQL_CALC_FOUND_ROWS
              j.id, j.title, j.company, j.location, j.job_type,
              LEFT(j.description, 220) AS description,
              j.phone, j.whatsapp, j.email, j.map_link, j.apply_link,
              j.featured, j.sponsored, j.slug, j.created_at, j.views,
              j.salary, j.visa_sponsored, j.verified,
              c.name AS category, c.slug AS category_slug,
              e.logo_url AS employer_logo
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
         LEFT JOIN employers e ON e.id = j.employer_id
       ${whereSql}
       ORDER BY ${sponsoredSql} DESC, ${featuredSql} DESC, ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    // Get total from FOUND_ROWS() — no extra table scan
    const [[{ total }]] = await db.query('SELECT FOUND_ROWS() AS total');

    res.json({
      success: true,
      total,
      page:    intOr(page, 1),
      perPage,
      pages:   Math.ceil(total / perPage),
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
    const { featuredSql, sponsoredSql } = await getPromotionSql();
    const [jobs] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.job_type,
              j.description, j.phone, j.whatsapp, j.email, j.map_link, j.extra_fields,
              j.featured, j.sponsored, j.verified, j.slug, j.created_at,
              c.name AS category, c.slug AS category_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
         LEFT JOIN employers e ON e.id = j.employer_id
        WHERE j.status = 'active'
          AND (j.employer_id IS NULL OR e.status = 'active')
          AND (${featuredSql} OR ${sponsoredSql})
        ORDER BY ${sponsoredSql} DESC, j.created_at DESC
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
    const [cats] = await db.query(
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

// GET /api/jobs/cities  – job counts per city for the cities grid
router.get('/cities', async (req, res) => {
  try {
    const [cities] = await db.query(
      `SELECT location AS city, COUNT(*) AS count
         FROM jobs
        WHERE status = 'active'
        GROUP BY location
        ORDER BY count DESC
        LIMIT 20`
    );
    res.json({ success: true, cities });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/job-of-day  – Phase 6: featured job of the day
router.get('/job-of-day', async (req, res) => {
  try {
    const { featuredSql, sponsoredSql } = await getPromotionSql();
    // Prefer featured/sponsored jobs from last 7 days
    let [rows] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.job_type,
              j.slug, j.created_at, j.salary, j.visa_sponsored, j.verified,
              j.whatsapp, j.phone, j.email, c.name AS category
         FROM jobs j JOIN categories c ON j.category_id = c.id
         LEFT JOIN employers e ON e.id = j.employer_id
        WHERE j.status = 'active' AND (j.employer_id IS NULL OR e.status = 'active')
          AND (${featuredSql} OR ${sponsoredSql})
          AND j.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY j.created_at DESC LIMIT 1`
    );
    if (rows.length === 0) {
      [rows] = await db.query(
        `SELECT j.id, j.title, j.company, j.location, j.job_type,
                j.slug, j.created_at, j.salary, j.visa_sponsored, j.verified,
                j.whatsapp, j.phone, j.email, c.name AS category
           FROM jobs j JOIN categories c ON j.category_id = c.id
           LEFT JOIN employers e ON e.id = j.employer_id
          WHERE j.status = 'active' AND (j.employer_id IS NULL OR e.status = 'active')
          ORDER BY j.created_at DESC LIMIT 1`
      );
    }
    if (rows.length === 0) return res.json({ success: false });
    res.json({ success: true, job: rows[0] });
  } catch (err) {
    console.error('[job-of-day]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/trends  – Phase 6: hiring trends for chart + top categories
router.get('/trends', async (req, res) => {
  try {
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%b %Y') AS label,
              DATE_FORMAT(created_at, '%Y-%m') AS month,
              COUNT(*) AS count
         FROM jobs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY month, label ORDER BY month ASC`
    );
    const [topCategories] = await db.query(
      `SELECT c.name, COUNT(*) AS count
         FROM jobs j JOIN categories c ON j.category_id = c.id
        WHERE j.status = 'active'
          AND j.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY c.id, c.name ORDER BY count DESC LIMIT 6`
    );
    res.json({ success: true, months: monthly, topCategories });
  } catch (err) {
    console.error('[trends]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/jobs/submit  – public job submission (status = pending, admin reviews)
router.post('/submit', publicFormLimiter, validate(jobSubmitSchema), async (req, res) => {
  try {
    const {
      title, company, location, job_type = 'Full-time',
      description, phone, whatsapp, email, category_id, map_link, salary
    } = req.body;

    // Resolve category – use first available if none provided
    let catId = parseInt(category_id) || null;
    if (!catId) {
      const [[firstCat]] = await db.query('SELECT id FROM categories ORDER BY name LIMIT 1');
      catId = firstCat ? firstCat.id : null;
    }
    if (!catId) {
      return res.status(400).json({ success: false, message: 'No categories exist yet. Please contact the admin.' });
    }

    // Generate slug
    const base = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 80);
    const suffix = Date.now().toString(36);
    const slug   = `${base}-${suffix}`;

    await db.query(
      `INSERT INTO jobs
         (title, company, location, job_type, description, phone, whatsapp, email, salary,
          category_id, slug, status, featured, sponsored, created_at, map_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, NOW(), ?)`,
      [
        title.trim(), company.trim(), location.trim(), job_type,
        description.trim(),
        phone    ? phone.trim()    : null,
        whatsapp ? whatsapp.trim() : null,
        email    ? email.trim()    : null,
        salary   ? salary.trim()   : null,
        catId, slug,
        map_link ? map_link.trim() : null,
      ]
    );

    res.json({ success: true, message: 'Job submitted! It will go live after admin review.' });
  } catch (err) {
    console.error('Public job submit error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});


// GET /api/jobs/batch/:batchId  – public requirement share page data
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId || batchId.length < 8)
      return res.status(400).json({ success: false, message: 'Invalid batch ID' });

    const [jobs] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.job_type, j.positions,
              j.phone, j.whatsapp, j.email, j.salary, j.description, j.requirements,
              j.slug, j.created_at, j.expires_at, j.employer_id, j.status,
              c.name AS category
         FROM jobs j
         LEFT JOIN categories c ON j.category_id = c.id
         LEFT JOIN employers e ON e.id = j.employer_id
        WHERE j.batch_id = ? AND j.status = 'active'
          AND (j.employer_id IS NULL OR e.status = 'active')
        ORDER BY j.title ASC`,
      [batchId]
    );
    if (!jobs.length)
      return res.status(404).json({ success: false, message: 'Requirement not found or expired' });

    const [[employer]] = await db.query(
      `SELECT company_name, logo_url, city, sector FROM employers WHERE id = ?`,
      [jobs[0].employer_id]
    );

    const totalPositions = jobs.reduce((s, j) => s + (parseInt(j.positions) || 1), 0);

    res.json({ success: true, jobs, employer: employer || null, totalPositions });
  } catch (err) {
    console.error('[batch]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/jobs/:slug  – single job detail
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*, c.name AS category, c.slug AS category_slug,
              e.logo_url AS employer_logo
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
         LEFT JOIN employers e ON e.id = j.employer_id
        WHERE j.slug = ? AND j.status = 'active'
          AND (j.employer_id IS NULL OR e.status = 'active')
        LIMIT 1`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Parse extra_fields JSON
    try { rows[0].extra_fields = rows[0].extra_fields ? JSON.parse(rows[0].extra_fields) : null; } catch { rows[0].extra_fields = null; }

    // Increment views
    await db.query('UPDATE jobs SET views = views + 1 WHERE id = ?', [rows[0].id]);
    res.json({ success: true, job: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
