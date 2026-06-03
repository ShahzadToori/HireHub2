#!/usr/bin/env python3
"""
Adds grid PATCH routes + share routes to employer.js
Run: python3 patch_employer.py
"""
import sys, os

TARGET = os.path.expanduser('~/HireHub2/server/routes/employer.js')

NEW_ROUTES = r"""
/* ══════════════════════════════════════════════════════════════
   GRID — single-field PATCH endpoints + candidates aggregation
══════════════════════════════════════════════════════════════ */

// PATCH /api/employer/grid/jobs/:id
router.patch('/grid/jobs/:id', requireEmployer, async (req, res) => {
  try {
    const ALLOWED = ['title','location','job_type','salary','status','expires_at','description','requirements','positions'];
    const updates = {};
    for (const k of ALLOWED) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No valid fields' });
    if (updates.status && !['active','closed'].includes(updates.status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    const [[job]] = await db.query('SELECT id FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Not found' });
    const set = Object.keys(updates).map(k => `${k}=?`).join(', ');
    await db.query(`UPDATE jobs SET ${set}, updated_at=NOW() WHERE id=? AND employer_id=?`,
      [...Object.values(updates), req.params.id, req.employer.id]);
    res.json({ success: true });
  } catch (err) { console.error('[grid/jobs PATCH]', err); res.status(500).json({ success: false }); }
});

// PATCH /api/employer/grid/applications/:id
router.patch('/grid/applications/:id', requireEmployer, async (req, res) => {
  try {
    const ALLOWED = ['status','employer_notes'];
    const updates = {};
    for (const k of ALLOWED) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No valid fields' });
    if (updates.status && !['new','reviewed','shortlisted','rejected','hired'].includes(updates.status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    const set = Object.keys(updates).map(k => `${k}=?`).join(', ');
    await db.query(`UPDATE job_applications SET ${set} WHERE id=? AND employer_id=?`,
      [...Object.values(updates), req.params.id, req.employer.id]);
    res.json({ success: true });
  } catch (err) { console.error('[grid/apps PATCH]', err); res.status(500).json({ success: false }); }
});

// GET /api/employer/grid/candidates  — aggregated unique candidates
router.get('/grid/candidates', requireEmployer, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT full_name, nationality, iqama_status, phone, whatsapp,
             MAX(experience_years)  AS experience_years,
             MAX(has_certificate)   AS has_certificate,
             COUNT(DISTINCT job_id) AS jobs_applied,
             MAX(created_at)        AS last_applied
        FROM job_applications
       WHERE employer_id = ?
       GROUP BY full_name, COALESCE(phone,''), COALESCE(whatsapp,'')
       ORDER BY last_applied DESC`, [req.employer.id]);
    rows.forEach((r, i) => { r.id = i + 1; });
    res.json({ success: true, candidates: rows });
  } catch (err) { console.error('[grid/candidates]', err); res.status(500).json({ success: false }); }
});

// PATCH /api/employer/grid/templates/:id
router.patch('/grid/templates/:id', requireEmployer, async (req, res) => {
  try {
    const ALLOWED = ['name','title','location','job_type','salary','description','requirements'];
    const updates = {};
    for (const k of ALLOWED) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No valid fields' });
    const set = Object.keys(updates).map(k => `${k}=?`).join(', ');
    await db.query(`UPDATE job_templates SET ${set} WHERE id=? AND employer_id=?`,
      [...Object.values(updates), req.params.id, req.employer.id]);
    res.json({ success: true });
  } catch (err) { console.error('[grid/templates PATCH]', err); res.status(500).json({ success: false }); }
});

/* ══════════════════════════════════════════════════════════════
   SHARE — create & view shareable data links
══════════════════════════════════════════════════════════════ */

// POST /api/employer/share/create
router.post('/share/create', requireEmployer, async (req, res) => {
  try {
    const { data_type, privacy, title, status_filter, expires_days } = req.body;
    if (!['jobs','applications','candidates'].includes(data_type))
      return res.status(400).json({ success: false, message: 'Invalid data type' });
    const token   = makeToken();
    const days    = Math.min(parseInt(expires_days) || 30, 365);
    const expires = new Date(Date.now() + days * 86400000);
    const filters = status_filter ? JSON.stringify({ status: status_filter }) : null;
    await db.query(
      `INSERT INTO shared_views (employer_id, token, data_type, privacy, title, filters, expires_at)
       VALUES (?,?,?,?,?,?,?)`,
      [req.employer.id, token, data_type,
       privacy === 'private' ? 'private' : 'public',
       title || null, filters, expires]
    );
    const base = process.env.NODE_ENV === 'production'
      ? 'https://joborbit.org'
      : (process.env.SITE_URL || 'http://localhost:3000');
    res.json({ success: true, token, url: `${base}/shared-view.html?token=${token}` });
  } catch (err) { console.error('[share/create]', err); res.status(500).json({ success: false }); }
});

// GET /api/employer/share/:token  — no auth required (public endpoint)
router.get('/share/:token', async (req, res) => {
  try {
    const [[share]] = await db.query(
      'SELECT * FROM shared_views WHERE token = ? AND expires_at > NOW()',
      [req.params.token]
    );
    if (!share) return res.status(404).json({ success: false, message: 'Link not found or expired' });

    if (share.privacy === 'private') {
      const access = req.query.access;
      if (!access) return res.status(403).json({ success: false, message: 'Access required', requiresAccess: true });
      const [[approved]] = await db.query(
        'SELECT id FROM share_requests WHERE share_token=? AND access_token=? AND status="approved"',
        [share.token, access]
      );
      if (!approved) return res.status(403).json({ success: false, message: 'Access pending or denied' });
    }

    const filters = share.filters ? JSON.parse(share.filters) : {};
    let data = [];

    if (share.data_type === 'jobs') {
      const [rows] = await db.query(
        `SELECT title, company, location, job_type, salary, status, views, created_at
           FROM jobs WHERE employer_id=? AND status='active' ORDER BY created_at DESC`,
        [share.employer_id]
      );
      data = rows;
    } else if (share.data_type === 'applications') {
      let where = 'WHERE a.employer_id=?';
      const params = [share.employer_id];
      if (filters.status) { where += ' AND a.status=?'; params.push(filters.status); }
      const [rows] = await db.query(
        `SELECT a.full_name, j.title AS job_title, a.status,
                a.nationality, a.iqama_status, a.experience_years, a.created_at
           FROM job_applications a
           JOIN jobs j ON j.id = a.job_id
          ${where} ORDER BY a.created_at DESC`,
        params
      );
      data = rows;
    } else if (share.data_type === 'candidates') {
      const [rows] = await db.query(
        `SELECT full_name, nationality, iqama_status,
                MAX(experience_years)  AS experience_years,
                MAX(has_certificate)   AS has_certificate,
                COUNT(DISTINCT job_id) AS jobs_applied,
                MAX(created_at)        AS last_applied
           FROM job_applications
          WHERE employer_id=?
          GROUP BY full_name, COALESCE(phone,''), COALESCE(whatsapp,'')
          ORDER BY last_applied DESC`,
        [share.employer_id]
      );
      data = rows;
    }

    res.json({
      success: true,
      share: { data_type: share.data_type, title: share.title, privacy: share.privacy, created_at: share.created_at },
      data
    });
  } catch (err) { console.error('[share/token]', err); res.status(500).json({ success: false }); }
});

// POST /api/employer/share/request  — request access to a private link
router.post('/share/request', async (req, res) => {
  try {
    const { token, name, email } = req.body;
    if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email required' });
    const [[share]] = await db.query(
      'SELECT id FROM shared_views WHERE token=? AND expires_at>NOW() AND privacy="private"',
      [token]
    );
    if (!share) return res.status(404).json({ success: false, message: 'Link not found' });
    const accessToken = makeToken();
    await db.query(
      'INSERT INTO share_requests (share_token, requester_email, requester_name, access_token) VALUES (?,?,?,?)',
      [token, email.trim(), name?.trim() || null, accessToken]
    );
    res.json({ success: true, message: 'Request sent. The employer will review and contact you.' });
  } catch (err) { console.error('[share/request]', err); res.status(500).json({ success: false }); }
});

"""

MARKER = 'module.exports = router;'

with open(TARGET, 'r') as f:
    content = f.read()

if '/grid/jobs/:id' in content:
    print('Routes already exist in employer.js — skipping.')
    sys.exit(0)

if MARKER not in content:
    print(f'ERROR: Could not find "{MARKER}" in employer.js')
    sys.exit(1)

content = content.replace(MARKER, NEW_ROUTES + MARKER)

with open(TARGET, 'w') as f:
    f.write(content)

print('Done — grid + share routes added to employer.js')
