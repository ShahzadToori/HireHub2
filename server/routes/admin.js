const express  = require('express');
const slugify  = require('slugify');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const router   = express.Router();

// All admin routes require authentication
router.use(requireAdmin);

// ── Multer setup (logo upload) ─────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|svg|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper to generate unique slug
async function uniqueSlug(title, excludeId = null) {
  let base = slugify(title, { lower: true, strict: true });
  let slug = base;
  let i    = 1;
  while (true) {
    const sql = excludeId
      ? 'SELECT id FROM jobs WHERE slug = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM jobs WHERE slug = ? LIMIT 1';
    const args = excludeId ? [slug, excludeId] : [slug];
    const [rows] = await db.query(sql, args);
    if (rows.length === 0) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ── Dashboard stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[{ totalJobs }]]     = await db.query('SELECT COUNT(*) AS totalJobs FROM jobs');
    const [[{ activeJobs }]]    = await db.query('SELECT COUNT(*) AS activeJobs FROM jobs WHERE status="active"');
    const [[{ featuredJobs }]]  = await db.query('SELECT COUNT(*) AS featuredJobs FROM jobs WHERE featured=1 AND status="active"');
    const [[{ totalViews }]]    = await db.query('SELECT COALESCE(SUM(views),0) AS totalViews FROM jobs');
    const [recentJobs]          = await db.query(
      `SELECT j.id, j.title, j.company, j.status, j.created_at, c.name AS category
         FROM jobs j JOIN categories c ON j.category_id = c.id
         ORDER BY j.created_at DESC LIMIT 5`
    );

    res.json({ success: true, stats: { totalJobs, activeJobs, featuredJobs, totalViews }, recentJobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── List all jobs (admin) ──────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const { q, status, category, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(parseInt(limit) || 20, 100);
    const offset  = (parseInt(page) - 1) * perPage;

    let where  = [];
    let params = [];

    if (q) {
      where.push('(j.title LIKE ? OR j.company LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push('j.status = ?');
      params.push(status);
    }
    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM jobs j JOIN categories c ON j.category_id = c.id ${whereSql}`,
      params
    );

    const [jobs] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.status,
              j.featured, j.sponsored, j.views, j.created_at, j.slug,
              c.name AS category
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
       ${whereSql}
       ORDER BY j.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({ success: true, total, page: parseInt(page), perPage, pages: Math.ceil(total / perPage), jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Get single job (admin edit) ────────────────────────────────
router.get('/jobs/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*, c.slug AS category_slug
         FROM jobs j JOIN categories c ON j.category_id = c.id
        WHERE j.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, job: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Add job ────────────────────────────────────────────────────
router.post('/jobs', async (req, res) => {
  try {
    const {
      title, company, category_id, location, job_type = 'Full-time',
      description, phone, whatsapp, email, map_link, extra_fields,
      status = 'active', featured = 0, sponsored = 0, featured_until
    } = req.body;

    // Load form schema to determine required fields
    const [[schemaRow]] = await db.query(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = schemaRow ? JSON.parse(schemaRow.value) : { sections: [] };

    // Build a list of required core fields from the schema
    const requiredCore = [];
    schema.sections.forEach(sec => {
      if (sec.visible === false) return;
      (sec.fields || []).forEach(f => {
        if (f.visible === false) return;
        if (f.coreKey && f.required) {
          requiredCore.push(f.coreKey);
        }
      });
    });

    // Validate each required core field
    const missing = requiredCore.filter(key => !req.body[key]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missing.join(', ')}`
      });
    }

    const slug = await uniqueSlug(title);

    await db.query(
      `INSERT INTO jobs
         (title, company, category_id, location, job_type, description,
          phone, whatsapp, email, map_link, extra_fields, status, featured, sponsored, featured_until, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, company, category_id, location, job_type, description,
       phone || null, whatsapp || null, email || null, map_link || null,
       extra_fields ? JSON.stringify(extra_fields) : null,
       status, featured ? 1 : 0, sponsored ? 1 : 0,
       featured_until || null, slug]
    );

    res.json({ success: true, message: 'Job posted successfully', slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Update job ─────────────────────────────────────────────────
router.put('/jobs/:id', async (req, res) => {
  try {
    const {
      title, company, category_id, location, job_type,
      description, phone, whatsapp, email, map_link, extra_fields,
      status, featured, sponsored, featured_until
    } = req.body;

    // Load form schema to determine required fields
    const [[schemaRow]] = await db.query(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = schemaRow ? JSON.parse(schemaRow.value) : { sections: [] };

    // Build required core fields from schema
    const requiredCore = [];
    schema.sections.forEach(sec => {
      if (sec.visible === false) return;
      (sec.fields || []).forEach(f => {
        if (f.visible === false) return;
        if (f.coreKey && f.required) {
          requiredCore.push(f.coreKey);
        }
      });
    });

    // Validate each required core field
    const missing = requiredCore.filter(key => !req.body[key]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missing.join(', ')}`
      });
    }

    const [existing] = await db.query('SELECT slug FROM jobs WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });

    const slug = title ? await uniqueSlug(title, req.params.id) : existing[0].slug;

    await db.query(
      `UPDATE jobs SET
         title=?, company=?, category_id=?, location=?, job_type=?,
         description=?, phone=?, whatsapp=?, email=?, map_link=?, extra_fields=?,
         status=?, featured=?, sponsored=?, featured_until=?, slug=?
       WHERE id=?`,
      [title, company, category_id, location, job_type,
       description, phone || null, whatsapp || null, email || null, map_link || null,
       extra_fields ? JSON.stringify(extra_fields) : null,
       status, featured ? 1 : 0, sponsored ? 1 : 0,
       featured_until || null, slug, req.params.id]
    );

    res.json({ success: true, message: 'Job updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Delete single job ──────────────────────────────────────────
router.delete('/jobs/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Bulk delete ────────────────────────────────────────────────
router.delete('/jobs', async (req, res) => {
  try {
    const { ids, status, category } = req.body;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await db.query(`DELETE FROM jobs WHERE id IN (${placeholders})`, ids);
      return res.json({ success: true, message: `${ids.length} jobs deleted` });
    }

    // Filter-based bulk delete
    let where  = [];
    let params = [];
    if (status)   { where.push('status = ?');       params.push(status); }
    if (category) { where.push('category_id = ?');  params.push(category); }

    if (where.length === 0) {
      return res.status(400).json({ success: false, message: 'Specify ids or filters for bulk delete' });
    }

    const [result] = await db.query(
      `DELETE FROM jobs WHERE ${where.join(' AND ')}`, params
    );

    res.json({ success: true, message: `${result.affectedRows} jobs deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Upload logo ────────────────────────────────────────────────
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const logoUrl = `/uploads/${req.file.filename}`;
    await db.query('UPDATE settings SET `value`=? WHERE `key`="logo_url"', [logoUrl]);
    res.json({ success: true, logoUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Categories CRUD ────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  const [cats] = await db.query('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, categories: cats });
});

router.post('/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const slug = slugify(name, { lower: true, strict: true });
    await db.query('INSERT INTO categories (name, slug) VALUES (?,?)', [name, slug]);
    res.json({ success: true, message: 'Category added' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Monetization ───────────────────────────────────────────────
router.get('/monetization', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM monetization');
  const [ads]  = await db.query('SELECT * FROM ad_placements');
  res.json({ success: true, features: rows, adPlacements: ads });
});

router.put('/monetization/:id', async (req, res) => {
  try {
    const { enabled, price, duration_days } = req.body;
    await db.query(
      'UPDATE monetization SET enabled=?, price=?, duration_days=? WHERE id=?',
      [enabled ? 1 : 0, price, duration_days, req.params.id]
    );
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/ad-placements/:id', async (req, res) => {
  try {
    const { ad_code, enabled } = req.body;
    await db.query(
      'UPDATE ad_placements SET ad_code=?, enabled=? WHERE id=?',
      [ad_code, enabled ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Ad placement updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Form Schema V2 (unified: all sections + all fields) ────────
const DEFAULT_SCHEMA_V2 = {"sections":[{"id":"sec_details","title":"Job Details","visible":true,"icon":"briefcase","fields":[{"id":"fld_title","coreKey":"title","label":"Job Title","labelSize":"sm","labelBold":true,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. Senior Frontend Developer","required":true,"visible":true,"width":"full","helpText":""},{"id":"fld_company","coreKey":"company","label":"Company Name","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. Tech Corp Ltd","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_location","coreKey":"location","label":"Location","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. New York, NY or Remote","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_category","coreKey":"category_id","label":"Category","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"category","placeholder":"","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_jobtype","coreKey":"job_type","label":"Job Type","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"jobtype","placeholder":"","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_desc","coreKey":"description","label":"Description","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"textarea","placeholder":"Describe the role, responsibilities, requirements...","required":true,"visible":true,"width":"full","helpText":"Be detailed - more info means better matches."}]},{"id":"sec_contact","title":"Contact Information","visible":true,"icon":"telephone","fields":[{"id":"fld_phone","coreKey":"phone","label":"Phone","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"tel","placeholder":"+1 555 000 0000","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_wa","coreKey":"whatsapp","label":"WhatsApp","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"tel","placeholder":"+1 555 000 0000","required":false,"visible":true,"width":"half","helpText":"With country code, no spaces"},{"id":"fld_email","coreKey":"email","label":"Email","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"email","placeholder":"jobs@company.com","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_maplink","coreKey":"map_link","label":"Map Location Link","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"url","placeholder":"https://maps.google.com/?q=...","required":false,"visible":true,"width":"half","helpText":"Paste any Google Maps URL"}]}]};

router.get('/form-schema', async (req, res) => {
  try {
    const [[row]] = await db.query(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = row ? JSON.parse(row.value) : DEFAULT_SCHEMA_V2;
    res.json({ success: true, schema });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/form-schema', async (req, res) => {
  try {
    const schema = JSON.stringify(req.body.schema);
    await db.query(
      "INSERT INTO settings (`key`, `value`) VALUES ('form_schema_v2', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [schema, schema]
    );
    res.json({ success: true, message: 'Form schema saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
