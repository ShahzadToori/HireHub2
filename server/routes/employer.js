'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const db       = require('../db/connection');
const { requireEmployer } = require('../middleware/employerAuth');
const router   = express.Router();

// ─── helpers ────────────────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}
function makeToken() { return crypto.randomBytes(32).toString('hex'); }

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */

// POST /api/employer/register
router.post('/register', async (req, res) => {
  try {
    const { company_name, contact_name, email, password, phone, whatsapp, sector, city } = req.body;

    if (!company_name?.trim()) return res.status(400).json({ success: false, message: 'Company name is required' });
    if (!email?.trim())        return res.status(400).json({ success: false, message: 'Email is required' });
    if (!password || password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    // Check duplicate
    const [[existing]] = await db.query('SELECT id FROM employers WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) return res.status(400).json({ success: false, message: 'An account with this email already exists' });

    const hash  = await bcrypt.hash(password, 12);
    const token = makeToken();

    const [result] = await db.query(
      `INSERT INTO employers (company_name, contact_name, email, password_hash, phone, whatsapp, sector, city, verify_token, status)
       VALUES (?,?,?,?,?,?,?,?,?,'active')`,
      [
        company_name.trim(), contact_name?.trim() || '', email.trim().toLowerCase(),
        hash, phone?.trim() || null, whatsapp?.trim() || null,
        sector?.trim() || null, city?.trim() || null, token
      ]
    );

    // Create session
    const sessionToken = makeToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await db.query(
      'INSERT INTO employer_sessions (employer_id, token, expires_at) VALUES (?,?,?)',
      [result.insertId, sessionToken, expires]
    );

    res.cookie('emp_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: 'Account created successfully',
      employer: { id: result.insertId, company_name: company_name.trim(), email: email.trim() }
    });
  } catch (err) {
    console.error('[employer/register]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const [[emp]] = await db.query(
      'SELECT * FROM employers WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    if (!emp) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    if (emp.status === 'suspended') return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });

    const match = await bcrypt.compare(password, emp.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    // Clear old sessions
    await db.query('DELETE FROM employer_sessions WHERE employer_id = ? AND expires_at < NOW()', [emp.id]);

    const sessionToken = makeToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO employer_sessions (employer_id, token, expires_at) VALUES (?,?,?)',
      [emp.id, sessionToken, expires]
    );

    await db.query('UPDATE employers SET last_login = NOW() WHERE id = ?', [emp.id]);

    res.cookie('emp_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      employer: {
        id: emp.id, company_name: emp.company_name,
        contact_name: emp.contact_name, email: emp.email,
        city: emp.city, sector: emp.sector, logo_url: emp.logo_url
      }
    });
  } catch (err) {
    console.error('[employer/login]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/logout
router.post('/logout', requireEmployer, async (req, res) => {
  try {
    const token = req.cookies?.emp_token || req.headers['x-employer-token'];
    await db.query('DELETE FROM employer_sessions WHERE token = ?', [token]);
    res.clearCookie('emp_token');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employer/me
router.get('/me', requireEmployer, async (req, res) => {
  try {
    const [[emp]] = await db.query(
      'SELECT id, company_name, contact_name, email, phone, whatsapp, sector, city, logo_url, about, website, status, created_at FROM employers WHERE id = ?',
      [req.employer.id]
    );
    const [[{ total_jobs }]] = await db.query(
      'SELECT COUNT(*) AS total_jobs FROM jobs WHERE employer_id = ? AND status = "active"',
      [req.employer.id]
    );
    const [[{ total_applications }]] = await db.query(
      'SELECT COUNT(*) AS total_applications FROM job_applications WHERE employer_id = ?',
      [req.employer.id]
    );
    const [[{ new_applications }]] = await db.query(
      'SELECT COUNT(*) AS new_applications FROM job_applications WHERE employer_id = ? AND status = "new"',
      [req.employer.id]
    );
    res.json({ success: true, employer: emp, stats: { total_jobs, total_applications, new_applications } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employer/profile
router.put('/profile', requireEmployer, async (req, res) => {
  try {
    const { company_name, contact_name, phone, whatsapp, sector, city, about, website } = req.body;
    await db.query(
      `UPDATE employers SET company_name=?, contact_name=?, phone=?, whatsapp=?, sector=?, city=?, about=?, website=? WHERE id=?`,
      [company_name, contact_name, phone, whatsapp, sector, city, about, website, req.employer.id]
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   JOBS
══════════════════════════════════════════════════════════════ */

// GET /api/employer/jobs
router.get('/jobs', requireEmployer, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*, c.name AS category_name,
              s.nationalities AS sc_nat, s.iqama_types AS sc_iq,
              s.min_experience AS sc_exp, s.required_certs AS sc_certs,
              s.custom_questions AS sc_cq, s.require_iqama_number AS sc_riq,
              (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id) AS application_count,
              (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id AND a.status = 'new') AS new_applications
         FROM jobs j
         LEFT JOIN categories c ON c.id = j.category_id
         LEFT JOIN job_screening s ON s.job_id = j.id
        WHERE j.employer_id = ?
        ORDER BY j.created_at DESC`,
      [req.employer.id]
    );
    const jobs = rows.map(j => {
      const sc = { nationalities:j.sc_nat, iqama_types:j.sc_iq, min_experience:j.sc_exp, required_certs:j.sc_certs, custom_questions:j.sc_cq?JSON.parse(j.sc_cq):[], require_iqama_number:j.sc_riq||false };
      delete j.sc_nat; delete j.sc_iq; delete j.sc_exp; delete j.sc_certs; delete j.sc_cq; delete j.sc_riq;
      j.screening = (sc.nationalities||sc.iqama_types||sc.min_experience||sc.required_certs||sc.custom_questions.length||sc.require_iqama_number)?sc:null;
      return j;
    });
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/jobs
router.post('/jobs', requireEmployer, async (req, res) => {
  try {
    const {
      title, category_id, location, job_type, description,
      requirements, salary, positions, phone, whatsapp, email,
      expires_days, screening
    } = req.body;

    if (!title?.trim())    return res.status(400).json({ success: false, message: 'Job title is required' });
    if (!location?.trim()) return res.status(400).json({ success: false, message: 'Location is required' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });

    // Get employer company name
    const [[emp]] = await db.query('SELECT company_name FROM employers WHERE id = ?', [req.employer.id]);

    // Generate unique slug
    let baseSlug = slugify(title + '-' + location);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const [[existing]] = await db.query('SELECT id FROM jobs WHERE slug = ?', [slug]);
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const expiresAt = expires_days
      ? new Date(Date.now() + parseFloat(expires_days) * 86400000)
      : null;

    const [result] = await db.query(
      `INSERT INTO jobs
         (employer_id, title, company, category_id, location, job_type, description,
          requirements, salary, positions, phone, whatsapp, email, slug, status,
          expires_at, posted_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,'employer',NOW())`,
      [
        req.employer.id, title.trim(), emp.company_name,
        category_id || null, location.trim(), job_type || 'Full-time',
        description.trim(), requirements?.trim() || null,
        salary?.trim() || null, positions || 1,
        phone?.trim() || null, whatsapp?.trim() || null,
        email?.trim() || null, slug, expiresAt
      ]
    );

    // Save screening questions if provided
    if (screening && Object.keys(screening).length > 0) {
      const customQs = screening.custom_questions && screening.custom_questions.length
        ? JSON.stringify(screening.custom_questions)
        : null;
      await db.query(
        `INSERT INTO job_screening (job_id, nationalities, iqama_types, min_experience, required_certs, custom_questions, require_iqama_number)
         VALUES (?,?,?,?,?,?,?)`,
        [
          result.insertId,
          screening.nationalities || null,
          screening.iqama_types   || null,
          screening.min_experience || 0,
          screening.required_certs || null,
          customQs,
          screening.require_iqama_number ? 1 : 0
        ]
      );
    }

    res.json({
      success: true,
      message: 'Job posted successfully',
      job: { id: result.insertId, slug }
    });
  } catch (err) {
    console.error('[employer/jobs POST]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employer/jobs/:id
router.put('/jobs/:id', requireEmployer, async (req, res) => {
  try {
    const { title, category_id, location, job_type, description, requirements, salary, positions, phone, whatsapp, email, status, expires_days } = req.body;

    // Verify ownership
    const [[job]] = await db.query('SELECT id FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const expiresAt = expires_days
      ? new Date(Date.now() + parseFloat(expires_days) * 86400000)
      : null;

    await db.query(
      `UPDATE jobs SET title=?, category_id=?, location=?, job_type=?, description=?,
       requirements=?, salary=?, positions=?, phone=?, whatsapp=?, email=?, status=?,
       expires_at=?
       WHERE id=? AND employer_id=?`,
      [title, category_id, location, job_type, description, requirements, salary, positions, phone, whatsapp, email, status || 'active', expiresAt, req.params.id, req.employer.id]
    );
    // Upsert screening filters
    const { screening } = req.body;
    if (screening !== undefined) {
      const customQs = screening.custom_questions && screening.custom_questions.length ? JSON.stringify(screening.custom_questions) : null;
      const [[existSc]] = await db.query('SELECT id FROM job_screening WHERE job_id = ?', [req.params.id]);
      if (existSc) {
        await db.query(
          'UPDATE job_screening SET nationalities=?,iqama_types=?,min_experience=?,required_certs=?,custom_questions=?,require_iqama_number=? WHERE job_id=?',
          [screening.nationalities||null, screening.iqama_types||null, screening.min_experience||null, screening.required_certs||null, customQs, screening.require_iqama_number?1:0, req.params.id]
        );
      } else if (screening.nationalities||screening.iqama_types||screening.min_experience||screening.required_certs||customQs) {
        await db.query(
          'INSERT INTO job_screening (job_id,nationalities,iqama_types,min_experience,required_certs,custom_questions) VALUES (?,?,?,?,?,?)',
          [req.params.id, screening.nationalities||null, screening.iqama_types||null, screening.min_experience||null, screening.required_certs||null, customQs]
        );
      }
    }

    res.json({ success: true, message: 'Job updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/employer/jobs/:id
router.delete('/jobs/:id', requireEmployer, async (req, res) => {
  try {
    const [[job]] = await db.query('SELECT id FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    await db.query('UPDATE jobs SET status = "closed" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Job closed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/jobs/:id/repost
router.post('/jobs/:id/repost', requireEmployer, async (req, res) => {
  try {
    const [[job]] = await db.query('SELECT * FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    await db.query(
      'UPDATE jobs SET status = "active", created_at = NOW(), expires_at = ? WHERE id = ?',
      [new Date(Date.now() + 30 * 86400000), req.params.id]
    );
    res.json({ success: true, message: 'Job reposted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   TEMPLATES
══════════════════════════════════════════════════════════════ */

// GET /api/employer/templates
router.get('/templates', requireEmployer, async (req, res) => {
  try {
    const [templates] = await db.query(
      'SELECT * FROM job_templates WHERE employer_id = ? ORDER BY name ASC',
      [req.employer.id]
    );
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/templates
router.post('/templates', requireEmployer, async (req, res) => {
  try {
    const { name, title, category_id, location, job_type, description, salary, requirements } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Template name is required' });

    const [result] = await db.query(
      `INSERT INTO job_templates (employer_id, name, title, category_id, location, job_type, description, salary, requirements)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.employer.id, name.trim(), title, category_id, location, job_type, description, salary, requirements]
    );
    res.json({ success: true, id: result.insertId, message: 'Template saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/employer/templates/:id
router.delete('/templates/:id', requireEmployer, async (req, res) => {
  try {
    await db.query('DELETE FROM job_templates WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   APPLICATIONS
══════════════════════════════════════════════════════════════ */

// GET /api/employer/applications
router.get('/applications', requireEmployer, async (req, res) => {
  try {
    const { job_id, status } = req.query;
    let where = 'WHERE a.employer_id = ?';
    const params = [req.employer.id];

    if (job_id) { where += ' AND a.job_id = ?'; params.push(job_id); }
    if (status)  { where += ' AND a.status = ?'; params.push(status); }

    const [applications] = await db.query(
      `SELECT a.*, j.title AS job_title, j.location AS job_location
         FROM job_applications a
         JOIN jobs j ON j.id = a.job_id
        ${where}
        ORDER BY a.created_at DESC`,
      params
    );
    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employer/applications/:id
router.put('/applications/:id', requireEmployer, async (req, res) => {
  try {
    const { status, employer_notes } = req.body;
    const validStatuses = ['new','reviewed','shortlisted','rejected','hired'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    await db.query(
      'UPDATE job_applications SET status=?, employer_notes=? WHERE id=? AND employer_id=?',
      [status, employer_notes || null, req.params.id, req.employer.id]
    );
    res.json({ success: true, message: 'Application updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   PUBLIC — Apply to a job
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   PUBLIC — Get screening questions for a job
══════════════════════════════════════════════════════════════ */
router.get('/screening/:jobId', async (req, res) => {
  try {
    const [[screening]] = await db.query(
      'SELECT * FROM job_screening WHERE job_id = ?',
      [req.params.jobId]
    );
    if (!screening) {
      return res.json({ success: true, questions: [], filters: {} });
    }
    const questions = JSON.parse(screening.custom_questions || '[]');
    const filters = { nationalities:screening.nationalities||null, iqama_types:screening.iqama_types||null, min_experience:screening.min_experience||null, required_certs:screening.required_certs||null, require_iqama_number:screening.require_iqama_number||false };
    res.json({ success: true, questions, filters });
  } catch(err) {
    res.json({ success: true, questions: [] });
  }
});

// POST /api/employer/apply/:jobId
router.post('/apply/:jobId', async (req, res) => {
  try {
    const { full_name, email, phone, whatsapp, nationality, iqama_status, iqama_number,
            experience_years, has_certificate, cover_note, screening_answers } = req.body;

    if (!full_name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!phone?.trim() && !whatsapp?.trim()) return res.status(400).json({ success: false, message: 'Phone or WhatsApp is required' });

    const [[job]] = await db.query(
      'SELECT id, employer_id, title, company, status FROM jobs WHERE id = ? AND status = "active"',
      [req.params.jobId]
    );
    if (!job) return res.status(404).json({ success: false, message: 'Job not found or no longer active' });

    // Check fixed screening requirements
    const [[screening]] = await db.query('SELECT * FROM job_screening WHERE job_id = ?', [job.id]);
    if (screening) {
      if (screening.nationalities && nationality) {
        const allowed = screening.nationalities.split(',').map(n => n.trim().toLowerCase());
        if (!allowed.includes(nationality.toLowerCase()) && !allowed.includes('any')) {
          return res.status(400).json({ success: false, message: 'Sorry, this job is not open to your nationality' });
        }
      }
      if (screening.min_experience && experience_years < screening.min_experience) {
        return res.status(400).json({ success: false, message: `This job requires at least ${screening.min_experience} years of experience` });
      }
    }

    // Answers saved in screening_answers column — cover_note is candidate message only
    let fullNote = cover_note || '';

    // Build structured Q&A for grid display
    let sqJson = null;
    if (screening_answers && screening_answers.length) {
      try {
        const qs = screening && screening.custom_questions ? JSON.parse(screening.custom_questions) : [];
        const sq = screening_answers.filter(a => a.answer).map(a => ({ q: qs[a.q]?.text || ('Q'+(a.q+1)), a: a.answer }));
        if (sq.length) sqJson = JSON.stringify(sq);
      } catch(e) {}
    }

    await db.query(
      `INSERT INTO job_applications
         (job_id, employer_id, full_name, email, phone, whatsapp, nationality,
          iqama_status, iqama_number, experience_years, has_certificate, cover_note, screening_answers)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        job.id, job.employer_id, full_name.trim(),
        email?.trim() || null, phone?.trim() || null,
        whatsapp?.trim() || null, nationality?.trim() || null,
        iqama_status?.trim() || null, iqama_number?.trim() || null, experience_years || null,
        has_certificate ? 1 : 0, fullNote || null, sqJson
      ]
    );

    // Send email confirmation to candidate
    if (email?.trim()) {
      try {
        const { sendMail } = require('../utils/mailer');
        await sendMail({
          to: email.trim(),
          subject: `Application Received — ${job.title} at ${job.company}`,
          html: `
            <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
              <div style="background:#0f62fe;padding:2rem 1.5rem">
                <h1 style="color:#fff;font-size:1.4rem;margin:0;font-weight:800">Application Received ✅</h1>
              </div>
              <div style="padding:1.5rem">
                <p style="color:#374151;font-size:.95rem">Hi <strong>${full_name}</strong>,</p>
                <p style="color:#374151;font-size:.95rem">Your application for <strong>${job.title}</strong> at <strong>${job.company}</strong> has been received.</p>
                <div style="background:#f3f4f6;border-radius:10px;padding:1rem 1.25rem;margin:1rem 0">
                  <p style="margin:0;font-size:.85rem;color:#6b7280">📋 <strong>Job:</strong> ${job.title}</p>
                  <p style="margin:.4rem 0 0;font-size:.85rem;color:#6b7280">🏢 <strong>Company:</strong> ${job.company}</p>
                </div>
                <p style="color:#374151;font-size:.9rem">The employer will review your application and contact you directly via phone or WhatsApp if shortlisted.</p>
                <p style="color:#9ca3af;font-size:.8rem;margin-top:1.5rem">Browse more jobs at <a href="https://joborbit.org" style="color:#0f62fe">joborbit.org</a></p>
              </div>
            </div>`
        });
      } catch(mailErr) {
        console.error('[apply email]', mailErr.message);
      }
    }

    res.json({ success: true, message: 'Application submitted successfully. The employer will contact you.' });
  } catch (err) {
    console.error('[apply]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


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


/* ══════════════════════════════════════════════════════════════
   EMPLOYER FEEDBACK
══════════════════════════════════════════════════════════════ */

// POST /api/employer/feedback
router.post('/feedback', requireEmployer, async (req, res) => {
  try {
    const { rating, category, message, page_url } = req.body;
    if (!rating || !category || !message?.trim())
      return res.status(400).json({ success: false, message: 'Rating, category and message are required' });
    if (rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: 'Invalid rating' });
    if (!['bug','feature','general','other'].includes(category))
      return res.status(400).json({ success: false, message: 'Invalid category' });

    const [[emp]] = await db.query('SELECT company_name FROM employers WHERE id = ?', [req.employer.id]);

    await db.query(
      `INSERT INTO employer_feedback (employer_id, company_name, rating, category, message, page_url)
       VALUES (?,?,?,?,?,?)`,
      [req.employer.id, emp?.company_name || null, rating, category, message.trim(), page_url || null]
    );

    // Email notification
    try {
      const { sendMail } = require('../utils/mailer');
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const catLabels = { bug:'🐛 Bug Report', feature:'✨ Feature Request', general:'💬 General', other:'📝 Other' };
      await sendMail({
        to: process.env.MAIL_USER,
        subject: `[JobOrbit Feedback] ${catLabels[category]} — ${emp?.company_name} ${stars}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#0f62fe">New Employer Feedback</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:.5rem;font-weight:bold;color:#6b7280">Company</td><td style="padding:.5rem">${emp?.company_name || '—'}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:.5rem;font-weight:bold;color:#6b7280">Rating</td><td style="padding:.5rem;font-size:1.2rem;color:#f59e0b">${stars}</td></tr>
              <tr><td style="padding:.5rem;font-weight:bold;color:#6b7280">Category</td><td style="padding:.5rem">${catLabels[category]}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:.5rem;font-weight:bold;color:#6b7280">Page</td><td style="padding:.5rem">${page_url || '—'}</td></tr>
            </table>
            <div style="margin-top:1rem;padding:1rem;background:#f3f4f6;border-radius:8px">
              <strong style="color:#374151">Message:</strong>
              <p style="margin:.5rem 0 0;color:#1f2937">${message.trim().split('\n').join('<br>')}</p>
            </div>
          </div>
        `
      });
    } catch(emailErr) { console.error('[feedback email]', emailErr); }

    res.json({ success: true });
  } catch (err) {
    console.error('[feedback POST]', err);
    res.status(500).json({ success: false });
  }
});
module.exports = router;
