const express = require('express');
const slugify = require('slugify');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const crypto = require('crypto');
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const { exec } = require('child_process');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { isValidImage, isValidSpreadsheet, deleteFile } = require('../utils/fileValidation');
const { authenticatedLimiter } = require('../middleware/tieredRateLimit');
const router = express.Router();

// All admin routes require authentication
router.use(requireAdmin);
// Looser tier than the public-facing endpoints — these routes are only
// reachable by a logged-in admin already, but still bounded (not
// unlimited) in case a session is ever compromised or a script misfires.
router.use(authenticatedLimiter);

// ── Multer setup (site logo upload — image only, deliberately no SVG:
//    SVG is scriptable XML, not a verifiable raster format, and these
//    files are served back to every visitor from the public site) ────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WebP image files are allowed'));
    }
  }
});

// ── Multer setup (bulk job import — CSV/Excel) ──────────────────
// Stored outside the public web root and deleted after processing —
// these are transient data files, never meant to be served to anyone.
const bulkUploadDir = path.join(__dirname, '../../uploads-private/bulk-import');
const bulkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(bulkUploadDir, { recursive: true });
    cb(null, bulkUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `import-${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});
const bulkUpload = multer({
  storage: bulkStorage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(csv|xlsx|xls)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
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
    const [rows] = await db.execute(sql, args);
    if (rows.length === 0) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ── Dashboard stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[{ totalJobs }]]     = await db.execute('SELECT COUNT(*) AS totalJobs FROM jobs');
    const [[{ activeJobs }]]    = await db.execute('SELECT COUNT(*) AS activeJobs FROM jobs WHERE status="pending"');
    const [[{ featuredJobs }]]  = await db.execute('SELECT COUNT(*) AS featuredJobs FROM jobs WHERE featured=1 AND status="active"');
    const [[{ totalViews }]]    = await db.execute('SELECT COALESCE(SUM(views),0) AS totalViews FROM jobs');
    const [recentJobs]          = await db.execute(
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
    const { q, status, category, featured, sponsored, dateFrom, dateTo, sort, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(parseInt(limit) || 20, 100);
    const offset  = (parseInt(page) - 1) * perPage;

    let where  = [];
    let params = [];

    if (q) {
      where.push('(j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push('j.status = ?');
      params.push(status);
    }
    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }
    if (featured === '1') {
      where.push('j.featured = 1');
    }
    if (sponsored === '1') {
      where.push('j.sponsored = 1');
    }
    if (dateFrom) {
      where.push('DATE(j.created_at) >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push('DATE(j.created_at) <= ?');
      params.push(dateTo);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const orderSql = sort === 'oldest' ? 'ORDER BY j.created_at ASC'
                   : sort === 'title'  ? 'ORDER BY j.title ASC'
                   :                     'ORDER BY j.created_at DESC';

    const [[{ total }]] = await db.execute(
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
       ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({ success: true, total, page: parseInt(page), perPage, pages: Math.ceil(total / perPage), jobs });
  } catch (err) {
    console.error('Admin GET /jobs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Get single job (admin edit) ────────────────────────────────
router.get('/jobs/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
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
      description, phone, whatsapp, email, map_link, apply_link, extra_fields, salary,
      status = 'active', featured = 0, sponsored = 0, featured_until, sponsored_until
    } = req.body;

    if (!title || !company || !category_id || !location || !description) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const slug = await uniqueSlug(title);

    await db.execute(
      `INSERT INTO jobs
         (title, company, category_id, location, job_type, description,
          salary, phone, whatsapp, email, map_link, apply_link, extra_fields, status, featured, sponsored, featured_until, sponsored_until, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, company, category_id, location, job_type, description, salary || null,
       phone || null, whatsapp || null, email || null, map_link || null, apply_link || null,
       extra_fields ? JSON.stringify(extra_fields) : null,
       status, featured ? 1 : 0, sponsored ? 1 : 0,
       featured_until || null, sponsored_until || null, slug]
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
      description, phone, whatsapp, email, map_link, apply_link, extra_fields, salary,
      status, featured, sponsored, featured_until, sponsored_until
    } = req.body;

    const [existing] = await db.execute('SELECT slug FROM jobs WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });

    const slug = title ? await uniqueSlug(title, req.params.id) : existing[0].slug;

    await db.execute(
      `UPDATE jobs SET
         title=?, company=?, category_id=?, location=?, job_type=?,
         description=?, salary=?, phone=?, whatsapp=?, email=?, map_link=?, apply_link=?, extra_fields=?,
         status=?, featured=?, sponsored=?, featured_until=?, sponsored_until=?, slug=?
       WHERE id=?`,
      [title, company, category_id, location, job_type,
       description, salary || null, phone || null, whatsapp || null, email || null, map_link || null, apply_link || null,
       extra_fields ? JSON.stringify(extra_fields) : null,
       status, featured ? 1 : 0, sponsored ? 1 : 0,
       featured_until || null, sponsored_until || null, slug, req.params.id]
    );

    res.json({ success: true, message: 'Job updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// ── Toggle verified status ──────────────────────────────────────
router.patch("/jobs/:id/verify", async (req, res) => {
  try {
    const [job] = await db.execute("SELECT verified FROM jobs WHERE id = ?", [req.params.id]);
    if (!job.length) return res.status(404).json({ success: false, message: "Job not found" });
    const newVal = job[0].verified ? 0 : 1;
    await db.execute("UPDATE jobs SET verified = ? WHERE id = ?", [newVal, req.params.id]);
    res.json({ success: true, verified: newVal });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ── Delete single job ──────────────────────────────────────────
router.delete('/jobs/:id', async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM jobs WHERE id = ?', [req.params.id]);
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
      await db.execute(`DELETE FROM jobs WHERE id IN (${placeholders})`, ids);
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

    const [result] = await db.execute(
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
    if (!isValidImage(req.file.path)) {
      deleteFile(req.file.path);
      return res.status(400).json({ success: false, message: 'File is not a valid JPG, PNG, or WebP image' });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    await db.execute('UPDATE settings SET `value`=? WHERE `key`="logo_url"', [logoUrl]);
    res.json({ success: true, logoUrl });
  } catch (err) {
    console.error('[upload-logo]', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ── Categories CRUD ────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  const [cats] = await db.execute('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, categories: cats });
});

router.post('/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const slug = slugify(name, { lower: true, strict: true });
    await db.execute('INSERT INTO categories (name, slug) VALUES (?,?)', [name, slug]);
    res.json({ success: true, message: 'Category added' });
  } catch (err) {
    console.error('[categories POST]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('[categories DELETE]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Monetization ───────────────────────────────────────────────
router.get('/monetization', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM monetization');
    const [ads]  = await db.execute('SELECT * FROM ad_placements');
    res.json({ success: true, features: rows, adPlacements: ads });
  } catch (err) {
    console.error('[monetization GET]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/monetization/:id', async (req, res) => {
  try {
    const { enabled, price, duration_days } = req.body;
    await db.execute(
      'UPDATE monetization SET enabled=?, price=?, duration_days=? WHERE id=?',
      [enabled ? 1 : 0, price, duration_days, req.params.id]
    );
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    console.error('[monetization PUT]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/ad-placements/:id', async (req, res) => {
  try {
    const { ad_code, enabled } = req.body;
    await db.execute(
      'UPDATE ad_placements SET ad_code=?, enabled=? WHERE id=?',
      [ad_code, enabled ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Ad placement updated' });
  } catch (err) {
    console.error('[ad-placements PUT]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Form Schema V2 (unified: all sections + all fields) ────────
const DEFAULT_SCHEMA_V2 = {"sections":[{"id":"sec_details","title":"Job Details","visible":true,"icon":"briefcase","fields":[{"id":"fld_title","coreKey":"title","label":"Job Title","labelSize":"sm","labelBold":true,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. Senior Frontend Developer","required":true,"visible":true,"width":"full","helpText":""},{"id":"fld_company","coreKey":"company","label":"Company Name","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. Tech Corp Ltd","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_location","coreKey":"location","label":"Location","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"text","placeholder":"e.g. New York, NY or Remote","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_category","coreKey":"category_id","label":"Category","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"category","placeholder":"","required":true,"visible":true,"width":"half","helpText":""},{"id":"fld_jobtype","coreKey":"job_type","label":"Job Type","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"jobtype","placeholder":"","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_desc","coreKey":"description","label":"Description","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"textarea","placeholder":"Describe the role, responsibilities, requirements...","required":true,"visible":true,"width":"full","helpText":"Be detailed - more info means better matches."}]},{"id":"sec_contact","title":"Contact Information","visible":true,"icon":"telephone","fields":[{"id":"fld_phone","coreKey":"phone","label":"Phone","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"tel","placeholder":"+1 555 000 0000","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_wa","coreKey":"whatsapp","label":"WhatsApp","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"tel","placeholder":"+1 555 000 0000","required":false,"visible":true,"width":"half","helpText":"With country code, no spaces"},{"id":"fld_email","coreKey":"email","label":"Email","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"email","placeholder":"jobs@company.com","required":false,"visible":true,"width":"half","helpText":""},{"id":"fld_maplink","coreKey":"map_link","label":"Map Location Link","labelSize":"sm","labelBold":false,"labelItalic":false,"labelColor":"","type":"url","placeholder":"https://maps.google.com/?q=...","required":false,"visible":true,"width":"half","helpText":"Paste any Google Maps URL"}]}]};

router.get('/form-schema', async (req, res) => {
  try {
    const [[row]] = await db.execute(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = row ? JSON.parse(row.value) : DEFAULT_SCHEMA_V2;
    res.json({ success: true, schema });
  } catch (err) {
    console.error('[form-schema GET]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/form-schema', async (req, res) => {
  try {
    const schema = JSON.stringify(req.body.schema);
    await db.execute(
      "INSERT INTO settings (`key`, `value`) VALUES ('form_schema_v2', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [schema, schema]
    );
    res.json({ success: true, message: 'Form schema saved' });
  } catch (err) {
    console.error('[form-schema PUT]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/parse-job-message', requireAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'No message provided' });
  }

  // Create a temporary file to store the message
  const tempFile = path.join(__dirname, '../../temp_message.txt');
  await fsPromises.writeFile(tempFile, message); // Use fsPromises here

  // Path to Python script
  const scriptPath = path.join(__dirname, '../../scripts/parse_job.py');

exec(`/var/www/HireHub2/venv/bin/python ${scriptPath} < ${tempFile}`, async (error, stdout, stderr) => {
  // Clean up temp file
  await fsPromises.unlink(tempFile).catch(() => {});

  // Log for debugging
  console.log('--- Python stdout ---');
  console.log(stdout);
  console.log('--- Python stderr ---');
  console.log(stderr);

  if (error) {
    console.error('Python exec error:', error);
    return res.status(500).json({ success: false, message: 'AI parsing service is unavailable' });
  }

  // Extract JSON from stdout (find first '{' and last '}')
  const startIdx = stdout.indexOf('{');
  const endIdx = stdout.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    console.error('No JSON object found in Python output');
    return res.status(500).json({ success: false, message: 'AI service error: invalid output (no JSON)' });
  }
  const jsonStr = stdout.substring(startIdx, endIdx + 1);

  try {
    const extracted = JSON.parse(jsonStr);
    if (extracted.error) {
      return res.status(400).json({ success: false, message: extracted.error });
    }

    const result = {
      title: extracted.title || '',
      company: extracted.company || '',
      location: extracted.location || '',
      category: '',
      job_type: '',
      description: extracted.description || extracted.raw_message || '',
      phone: extracted.phone || '',
      whatsapp: extracted.phone || '',
      email: extracted.email || '',
      salary: extracted.salary || '',
      experience: extracted.experience || '',
      map_link: extracted.map_link || '',
      positions: '',
      requirements: '',
      benefits: '',
      featured: 0,
      sponsored: 0,
      featured_until: ''
    };

    res.json({ success: true, data: result });
  } catch (e) {
    console.error('Failed to parse JSON from Python output. Extracted string:', jsonStr);
    console.error('Full stdout:', stdout);
    res.status(500).json({ success: false, message: 'AI service error: invalid JSON' });
  }
});
});


// ── Bulk upload jobs from CSV or Excel ─────────────────────────────────
router.post('/bulk-upload', requireAdmin, bulkUpload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const results = [];
  const errors = [];
  let inserted = 0;
  let updated = 0;
  const fileExt = req.file.originalname.split('.').pop().toLowerCase();

  if ((fileExt === 'xlsx' || fileExt === 'xls') && !isValidSpreadsheet(req.file.path)) {
    deleteFile(req.file.path);
    return res.status(400).json({ success: false, message: 'File is not a valid Excel spreadsheet' });
  }

  // Helper to parse value (empty string becomes null)
const parseValue = (value, type = 'string', allowNull = true) => {
  if (value === undefined || value === null || value === '') {
    return allowNull ? null : '';
  }
  if (type === 'int') return parseInt(value);
  if (type === 'float') return parseFloat(value);
  if (type === 'bool') return value === 1 || value === '1' || value === true || value === 'true';
  return value.toString().trim();
};

  try {
    // Parse file based on extension
    if (fileExt === 'csv') {
      const fileStream = require('fs').createReadStream(req.file.path);
      await new Promise((resolve, reject) => {
        fileStream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      results.push(...jsonData);
    } else {
      throw new Error('Unsupported file type. Please upload CSV or Excel files only.');
    }

    // Process each row
    for (const row of results) {
      try {
        // Required fields
        // if (!row.title || !row.company || !row.location || !row.description) {
        //   errors.push(`Row skipped: missing required fields (title, company, location, description)`);
        //   continue;
        // }

        // Base job data from CSV/Excel
        // const jobData = {
        //   title: parseValue(row.title),
        //   company: parseValue(row.company),
        //   location: parseValue(row.location),
        //   description: parseValue(row.description),
        //   category_id: parseValue(row.category_id, 'int') || 1,
        //   job_type: parseValue(row.job_type) || 'Full-time',
        //   phone: parseValue(row.phone),
        //   whatsapp: parseValue(row.whatsapp),
        //   email: parseValue(row.email),
        //   map_link: parseValue(row.map_link),
        //   status: parseValue(row.status) || 'active',
        //   featured: parseValue(row.featured, 'int') || 0,
        //   sponsored: parseValue(row.sponsored, 'int') || 0,
        //   featured_until: parseValue(row.featured_until) || null,
        //   views: parseValue(row.views, 'int') || 0,
        // };

        const jobData = {
  title: parseValue(row.title, 'string', false),      // '' if missing
  company: parseValue(row.company, 'string', false),  // '' if missing
  location: parseValue(row.location, 'string', false),// '' if missing
  description: parseValue(row.description, 'string', false), // '' if missing
  // other fields keep the old behaviour (allowNull = true)
  category_id: parseValue(row.category_id, 'int') || 1,
  job_type: parseValue(row.job_type) || 'Full-time',
  phone: parseValue(row.phone),
  whatsapp: parseValue(row.whatsapp),
  email: parseValue(row.email),
  map_link: parseValue(row.map_link),
  apply_link: parseValue(row.apply_link),
  salary: parseValue(row.salary),
  status: parseValue(row.status) || 'active',
  featured: parseValue(row.featured, 'int') || 0,
  sponsored: parseValue(row.sponsored, 'int') || 0,
  featured_until: parseValue(row.featured_until) || null,
  views: parseValue(row.views, 'int') || 0,
};

        // Handle extra fields: any column not in the main list goes into extra_fields JSON
        const mainFields = ['title','company','location','description','salary','category_id','job_type','phone','whatsapp','email','map_link','apply_link','status','featured','sponsored','featured_until','views','slug','id'];
        const extraFields = {};
        for (const [key, val] of Object.entries(row)) {
          if (!mainFields.includes(key) && val !== undefined && val !== '') {
            extraFields[key] = parseValue(val);
          }
        }
        jobData.extra_fields = Object.keys(extraFields).length ? JSON.stringify(extraFields) : null;

        // Determine slug: use provided slug or generate from title
        // let slug = parseValue(row.slug);
        // if (!slug) {
        //   const slugify = require('slugify');
        //   slug = slugify(jobData.title, { lower: true, strict: true });
        //   let base = slug;
        //   let i = 1;
        //   while (true) {
        //     const [rows] = await db.execute('SELECT id FROM jobs WHERE slug = ?', [slug]);
        //     if (rows.length === 0) break;
        //     slug = `${base}-${i++}`;
        //   }
        // }

        // Determine slug: use provided slug or generate from title
let slug = parseValue(row.slug);
if (!slug) {
  let baseTitle = jobData.title.trim();
  if (!baseTitle) {
    baseTitle = `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  slug = slugify(baseTitle, { lower: true, strict: true });
  let base = slug;
  let i = 1;
  while (true) {
    const [rows] = await db.execute('SELECT id FROM jobs WHERE slug = ?', [slug]);
    if (rows.length === 0) break;
    slug = `${base}-${i++}`;
  }
}

        // Check if job exists by slug (or by id if provided)
        let existingId = null;
        if (row.id) {
          const [rows] = await db.execute('SELECT id FROM jobs WHERE id = ?', [parseValue(row.id, 'int')]);
          if (rows.length) existingId = rows[0].id;
        }
        if (!existingId) {
          const [rows] = await db.execute('SELECT id FROM jobs WHERE slug = ?', [slug]);
          if (rows.length) existingId = rows[0].id;
        }

        if (existingId) {
          // Update existing job (do not update id, created_at)
          await db.execute(
            `UPDATE jobs SET
              title = ?, company = ?, category_id = ?, location = ?, job_type = ?,
              description = ?, phone = ?, whatsapp = ?, email = ?, map_link = ?, apply_link = ?,
              extra_fields = ?, status = ?, featured = ?, sponsored = ?, featured_until = ?,
              views = ?, slug = ?
             WHERE id = ?`,
            [
              jobData.title, jobData.company, jobData.category_id, jobData.location, jobData.job_type,
              jobData.description, jobData.phone, jobData.whatsapp, jobData.email, jobData.map_link, jobData.apply_link,
              jobData.extra_fields, jobData.status, jobData.featured, jobData.sponsored, jobData.featured_until,
              jobData.views, slug,
              existingId
            ]
          );
          updated++;
        } else {
          // Insert new job
          await db.execute(
            `INSERT INTO jobs
              (title, company, category_id, location, job_type, description,
               salary, phone, whatsapp, email, map_link, apply_link, extra_fields, status, featured, sponsored, featured_until, views, slug)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jobData.title, jobData.company, jobData.category_id, jobData.location, jobData.job_type,
              jobData.description, jobData.salary || null, jobData.phone, jobData.whatsapp, jobData.email, jobData.map_link,  jobData.apply_link,
              jobData.extra_fields, jobData.status, jobData.featured, jobData.sponsored, jobData.featured_until,
              jobData.views, slug
            ]
          );
          inserted++;
        }
      } catch (err) {
        console.error('[bulk-upload row]', err);
        errors.push(`Row error (${row?.title || 'untitled row'}): could not be saved — check required fields and try again`);
      }
    }
  } catch (err) {
    console.error('[bulk-upload parse]', err);
    errors.push('Could not read the uploaded file — make sure it is a valid CSV or Excel file');
  } finally {
    // Clean up uploaded file
    require('fs').unlink(req.file.path, () => {});
  }

  res.json({
    success: true,
    inserted,
    updated,
    errors: errors.length ? errors : null,
    totalRows: results.length
  });
});

// ── Employer Feedback ─────────────────────────────────────────
router.get('/feedback', async (req, res) => {
  try {
    const { status, rating } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND status=?'; params.push(status); }
    if (rating) { where += ' AND rating=?'; params.push(parseInt(rating)); }
    const [rows] = await db.query(
      `SELECT * FROM employer_feedback ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json({ success: true, feedback: rows });
  } catch(err) { console.error('[admin/feedback]', err); res.status(500).json({ success: false }); }
});

router.patch('/feedback/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new','read','resolved'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    await db.query('UPDATE employer_feedback SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch(err) { console.error('[employer-feedback status]', err); res.status(500).json({ success: false }); }
});

module.exports = router;
