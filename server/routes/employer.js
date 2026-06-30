'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const db       = require('../db/connection');
const { requireEmployer } = require('../middleware/employerAuth');
const router   = express.Router();
const { sendMail } = require('../utils/mailer');

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
    const {
      company_name, contact_name, email, password, confirm_password,
      phone, whatsapp, sector, city, address, map_link,
      cr_number, website, about
    } = req.body;

    if (!company_name?.trim()) return res.status(400).json({ success: false, message: 'Company name is required' });
    if (!contact_name?.trim()) return res.status(400).json({ success: false, message: 'Your name is required' });
    if (!email?.trim())        return res.status(400).json({ success: false, message: 'Email is required' });
    if (!password || password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (password.length > 72)  return res.status(400).json({ success: false, message: 'Password must be 72 characters or less' });
    if (confirm_password !== undefined && password !== confirm_password)
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    if (!address?.trim())      return res.status(400).json({ success: false, message: 'Address is required' });

    // Server-side length guards (defense in depth — client maxlength can be bypassed via direct API calls)
    const lenChecks = [
      [company_name, 200, 'Company name'], [contact_name, 100, 'Your name'], [email, 160, 'Email'],
      [phone, 30, 'Phone'], [whatsapp, 30, 'WhatsApp'], [sector, 100, 'Sector'], [city, 100, 'City'],
      [address, 255, 'Address'], [map_link, 500, 'Map link'], [cr_number, 100, 'CR number'],
      [website, 300, 'Website'], [about, 2000, 'About']
    ];
    for (const [val, max, label] of lenChecks) {
      if (val && val.length > max) return res.status(400).json({ success: false, message: `${label} must be ${max} characters or less` });
    }

    // Check duplicate
    const [[existing]] = await db.query('SELECT id FROM employers WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) return res.status(400).json({ success: false, message: 'An account with this email already exists' });

    const hash  = await bcrypt.hash(password, 12);
    const token = makeToken();

    const [result] = await db.query(
      `INSERT INTO employers (company_name, contact_name, email, password_hash, phone, whatsapp, sector, city, address, map_link, cr_number, website, about, verify_token, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
      [
        company_name.trim(), contact_name.trim(), email.trim().toLowerCase(),
        hash, phone?.trim() || null, whatsapp?.trim() || null,
        sector?.trim() || null, city?.trim() || null,
        address.trim(), map_link?.trim() || null,
        cr_number?.trim() || null, website?.trim() || null, about?.trim() || null,
        token
      ]
    );

    // Notify admin of new employer registration (fire-and-forget)
    const _regBase = process.env.NODE_ENV === 'production'
      ? 'https://joborbit.org'
      : (process.env.SITE_URL || 'http://localhost:3000');
    sendMail({
      to: process.env.MAIL_USER,
      subject: `New Employer Registration — ${company_name.trim()} | JobOrbit`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
        <h2 style="color:#0f62fe;margin-bottom:.5rem">New Employer Registration</h2>
        <p style="color:#374151;margin-bottom:1rem">A new employer is awaiting your approval:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
          <tr><td style="padding:.35rem 0;color:#6b7280;width:110px;font-size:.9rem">Company</td><td style="padding:.35rem 0;font-weight:600">${company_name.trim()}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Contact</td><td style="padding:.35rem 0">${contact_name.trim()}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Email</td><td style="padding:.35rem 0">${email.trim().toLowerCase()}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Phone</td><td style="padding:.35rem 0">${phone?.trim() || '—'}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Sector</td><td style="padding:.35rem 0">${sector?.trim() || '—'}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">City</td><td style="padding:.35rem 0">${city?.trim() || '—'}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Address</td><td style="padding:.35rem 0">${address.trim()}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">CR Number</td><td style="padding:.35rem 0">${cr_number?.trim() || '—'}</td></tr>
          <tr><td style="padding:.35rem 0;color:#6b7280;font-size:.9rem">Map Link</td><td style="padding:.35rem 0">${map_link?.trim() ? `<a href="${map_link.trim()}">View on Map</a>` : '—'}</td></tr>
        </table>
        <a href="${_regBase}/admin/employers.html" style="display:inline-block;background:#0f62fe;color:#fff;padding:.65rem 1.4rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem">
          Review in Admin →
        </a>
        <p style="color:#9ca3af;font-size:.75rem;margin-top:1.5rem">JobOrbit Admin Notification</p>
      </div>`
    }).catch(e => console.warn('[register admin notify]', e.message));

    res.json({
      success: true,
      pending: true,
      message: 'Account created! Our team will review your application and notify you by email within 24 hours.'
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
    if (emp.status === 'pending')   return res.status(403).json({ success: false, message: 'Your account is pending approval. You will receive an email once it\'s approved.' });

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

// POST /api/employer/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const [[emp]] = await db.query('SELECT id, company_name, contact_name FROM employers WHERE email = ?', [cleanEmail]);

    // Always respond with the same generic message — don't reveal whether the email is registered
    const genericMsg = 'If an account exists with that email, a password reset link has been sent.';

    if (emp) {
      const token = makeToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.query('UPDATE employers SET reset_token=?, reset_expires=? WHERE id=?', [token, expires, emp.id]);

      const base = process.env.NODE_ENV === 'production' ? 'https://joborbit.org' : (process.env.SITE_URL || 'http://localhost:3000');
      const link = `${base}/employer/reset-password.html?token=${token}`;

      await sendMail({
        to: cleanEmail,
        subject: '🔑 Reset Your Password | JobOrbit',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
          <h2 style="color:#0f62fe;font-size:1.3rem;margin-bottom:.5rem">Reset Your Password</h2>
          <p>Hi ${emp.contact_name || emp.company_name || 'there'},</p>
          <p>We received a request to reset your JobOrbit employer account password. Click the button below to choose a new password.</p>
          <p style="margin:1.5rem 0">
            <a href="${link}" style="background:#0f62fe;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Reset Password →
            </a>
          </p>
          <p style="color:#6b7280;font-size:.82rem">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">
          <p style="color:#9ca3af;font-size:.75rem">Powered by <a href="${base}" style="color:#0f62fe">JobOrbit.org</a></p>
        </div>`
      }).catch(e => console.warn('[forgot-password email]', e.message));
    }

    res.json({ success: true, message: genericMsg });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token)    return res.status(400).json({ success: false, message: 'Reset token is required' });
    if (!password || password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const [[emp]] = await db.query(
      'SELECT id FROM employers WHERE reset_token = ? AND reset_expires > NOW()',
      [token]
    );
    if (!emp) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE employers SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?', [hash, emp.id]);

    // Security: log out of all existing sessions after password reset
    await db.query('DELETE FROM employer_sessions WHERE employer_id=?', [emp.id]);

    res.json({ success: true, message: 'Password updated successfully. You can now sign in with your new password.' });
  } catch (err) {
    console.error('[reset-password]', err);
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
      'SELECT id, company_name, contact_name, email, phone, whatsapp, sector, city, logo_url, about, website, status, created_at, address, map_link, company_size, cr_number, linkedin_url, founded_year, wa_template_single, wa_template_bulk FROM employers WHERE id = ?',
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
    const {
      company_name, contact_name, phone, whatsapp, sector, city, about, website,
      address, map_link, company_size, cr_number, linkedin_url, founded_year,
      wa_template_single, wa_template_bulk
    } = req.body;
    if (!company_name?.trim())
      return res.status(400).json({ success: false, message: 'Company name is required' });

    // Server-side length guards (defense in depth — client maxlength can be bypassed via direct API calls)
    const lenChecks = [
      [company_name, 200, 'Company name'], [contact_name, 100, 'Contact name'], [phone, 30, 'Phone'],
      [whatsapp, 30, 'WhatsApp'], [sector, 100, 'Sector'], [city, 100, 'City'], [website, 300, 'Website'],
      [address, 255, 'Address'], [map_link, 500, 'Map link'], [company_size, 50, 'Company size'],
      [cr_number, 100, 'CR number'], [linkedin_url, 255, 'LinkedIn URL'], [about, 2000, 'About']
    ];
    for (const [val, max, label] of lenChecks) {
      if (val && val.length > max) return res.status(400).json({ success: false, message: `${label} must be ${max} characters or less` });
    }

    await db.query(
      `UPDATE employers SET
         company_name=?, contact_name=?, phone=?, whatsapp=?, sector=?, city=?,
         about=?, website=?, address=?, map_link=?, company_size=?,
         cr_number=?, linkedin_url=?, founded_year=?,
         wa_template_single=?, wa_template_bulk=?, updated_at=NOW()
       WHERE id=?`,
      [
        company_name.trim(), contact_name||null, phone||null, whatsapp||null,
        sector||null, city||null, about||null, website||null,
        address||null, map_link||null, company_size||null,
        cr_number||null, linkedin_url||null, founded_year||null,
        wa_template_single||null, wa_template_bulk||null,
        req.employer.id
      ]
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('[profile PUT]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employer/change-password
router.put('/change-password', requireEmployer, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password) return res.status(400).json({ success: false, message: 'Current password is required' });
    if (!new_password || new_password.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    const [[emp]] = await db.query('SELECT password_hash FROM employers WHERE id = ?', [req.employer.id]);
    if (!emp) return res.status(404).json({ success: false, message: 'Account not found' });

    const match = await bcrypt.compare(current_password, emp.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE employers SET password_hash=? WHERE id=?', [hash, req.employer.id]);

    // Security: keep the current session active, but log out all other sessions
    const currentToken = req.cookies?.emp_token || req.headers['x-employer-token'];
    await db.query('DELETE FROM employer_sessions WHERE employer_id=? AND token != ?', [req.employer.id, currentToken]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[change-password]', err);
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
        WHERE j.employer_id = ? AND j.status != 'deleted'
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
      expires_days, screening, require_cv
    } = req.body;

    if (!title?.trim())    return res.status(400).json({ success: false, message: 'Job title is required' });
    if (!location?.trim()) return res.status(400).json({ success: false, message: 'Location is required' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });
    if (!category_id)      return res.status(400).json({ success: false, message: 'Category is required' });

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
          requirements, salary, positions, phone, whatsapp, email, slug, status, require_cv,
          expires_at, posted_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,'employer',NOW())`,
      [
        req.employer.id, title.trim(), emp.company_name,
        category_id || null, location.trim(), job_type || 'Full-time',
        description.trim(), requirements?.trim() || null,
        salary?.trim() || null, positions || 1,
        phone?.trim() || null, whatsapp?.trim() || null,
        email?.trim() || null, slug, require_cv ? 1 : 0, expiresAt
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
    const { title, category_id, location, job_type, description, requirements, salary, positions, phone, whatsapp, email, status, expires_days, require_cv } = req.body;

    // Verify ownership
    const [[job]] = await db.query('SELECT id FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (!title?.trim())    return res.status(400).json({ success: false, message: 'Job title is required' });
    if (!location?.trim()) return res.status(400).json({ success: false, message: 'Location is required' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });
    if (!category_id)      return res.status(400).json({ success: false, message: 'Category is required' });

    const expiresAt = expires_days
      ? new Date(Date.now() + parseFloat(expires_days) * 86400000)
      : null;

    await db.query(
      `UPDATE jobs SET title=?, category_id=?, location=?, job_type=?, description=?,
       requirements=?, salary=?, positions=?, phone=?, whatsapp=?, email=?, status=?, require_cv=?,
       expires_at=?
       WHERE id=? AND employer_id=?`,
      [title, category_id, location, job_type, description, requirements, salary, positions, phone, whatsapp, email, status || 'active', require_cv ? 1 : 0, expiresAt, req.params.id, req.employer.id]
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

// POST /api/employer/jobs/:id/delete — soft delete (hidden from employer + public, kept for admin)
router.post('/jobs/:id/delete', requireEmployer, async (req, res) => {
  try {
    const [[job]] = await db.query('SELECT id FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    await db.query('UPDATE jobs SET status = "deleted" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Job deleted' });
  } catch (err) {
    console.error('[jobs/:id/delete]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employer/jobs/:id/repost
router.post('/jobs/:id/repost', requireEmployer, async (req, res) => {
  try {
    const [[job]] = await db.query('SELECT * FROM jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.employer.id]);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    // Preserve the job's original posting duration instead of hardcoding 30 days
    let newExpiresAt = null;
    if (job.expires_at) {
      const durationMs = new Date(job.expires_at).getTime() - new Date(job.created_at).getTime();
      newExpiresAt = new Date(Date.now() + (durationMs > 0 ? durationMs : 30 * 86400000));
    }
    await db.query(
      'UPDATE jobs SET status = "active", created_at = NOW(), expires_at = ? WHERE id = ?',
      [newExpiresAt, req.params.id]
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
      [req.employer.id, name.trim(), title, category_id || null, location, job_type, description, salary, requirements]
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
      `SELECT a.*, j.title AS job_title, j.location AS job_location, j.batch_id
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
router.put('/applications/bulk-status', requireEmployer, async (req, res) => {
  try {
    const { ids, status } = req.body;
    const validStatuses = ['new','reviewed','shortlisted','rejected','hired'];
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'No applications selected' });
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const placeholders = ids.map(() => '?').join(',');
    await db.query(
      `UPDATE job_applications SET status=? WHERE employer_id=? AND id IN (${placeholders})`,
      [status, req.employer.id, ...ids]
    );
    res.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error('[applications/bulk-status]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    const [[jobCvRow]] = await db.query('SELECT require_cv FROM jobs WHERE id=?', [req.params.jobId]);
    res.json({ success: true, questions, filters, require_cv: jobCvRow?.require_cv || 0 });
  } catch(err) {
    res.json({ success: true, questions: [] });
  }
});

// ── CV upload storage (defined early — used in apply route) ──
const _multer = require('multer');
const _fs     = require('fs');
const _cvStorage = _multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = require('path').join(__dirname, '../../public/uploads/cvs');
    _fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'cv-' + require('crypto').randomBytes(16).toString('hex') + '.pdf');
  }
});
const cvUpload = _multer({
  storage: _cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  }
});

// POST /api/employer/apply/:jobId
router.post('/apply/:jobId', cvUpload.single('cv'), async (req, res) => {
  try {
    const full_name        = req.body.full_name;
    const email            = req.body.email;
    const phone            = req.body.phone;
    const whatsapp         = req.body.whatsapp;
    const nationality      = req.body.nationality;
    const iqama_status     = req.body.iqama_status;
    const iqama_number     = req.body.iqama_number;
    const experience_years = req.body.experience_years;
    const has_certificate  = req.body.has_certificate;
    const cover_note       = req.body.cover_note;
    const screening_answers = req.body.screening_answers;

    if (!full_name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!phone?.trim() && !whatsapp?.trim()) return res.status(400).json({ success: false, message: 'Phone or WhatsApp is required' });

    const [[job]] = await db.query(
      'SELECT id, employer_id, title, company, status, require_cv FROM jobs WHERE id = ? AND status = "active"',
      [req.params.jobId]
    );
    if (!job) return res.status(404).json({ success: false, message: 'Job not found or no longer active' });
    if (job.require_cv && !req.file) return res.status(400).json({ success: false, message: 'Please upload your CV (PDF, max 5MB) — it is required for this job' });

    // Prevent duplicate applications from the same person to the same job
    const contactPhone = phone?.trim() || whatsapp?.trim() || '';
    if (contactPhone) {
      const [[dup]] = await db.query(
        'SELECT id FROM job_applications WHERE job_id=? AND (phone=? OR whatsapp=?) LIMIT 1',
        [job.id, contactPhone, contactPhone]
      );
      if (dup) return res.status(400).json({ success: false, message: 'You have already applied to this job.' });
    }

    // Parse candidate's screening answers early (needed for custom-question enforcement below)
    let parsedAnswers = [];
    try {
      parsedAnswers = typeof screening_answers === 'string'
        ? JSON.parse(screening_answers || '[]')
        : (screening_answers || []);
    } catch(e) { parsedAnswers = []; }

    // Check ALL pre-screening filters set by the employer
    const [[screening]] = await db.query('SELECT * FROM job_screening WHERE job_id = ?', [job.id]);
    let customQs = [];
    if (screening) {
      // Nationality — if employer set a filter, candidate MUST provide a nationality
      if (screening.nationalities) {
        if (!nationality?.trim()) {
          return res.status(400).json({ success: false, message: 'Nationality is required for this job' });
        }
        const allowed = screening.nationalities.split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
        if (allowed.length && !allowed.includes(nationality.trim().toLowerCase()) && !allowed.includes('any')) {
          return res.status(400).json({ success: false, message: 'Sorry, this job is not open to your nationality' });
        }
      }

      // Iqama type — "transferable" or "local" (local transfer / visit visa)
      if (screening.iqama_types) {
        if (!iqama_status?.trim()) {
          return res.status(400).json({ success: false, message: 'Iqama status is required for this job' });
        }
        const status = iqama_status.trim().toLowerCase();
        const want   = screening.iqama_types.trim().toLowerCase();
        const matches =
          (want === 'transferable' && status === 'transferable') ||
          (want === 'local' && (status === 'non-transferable' || status === 'visit visa'));
        if (!matches) {
          return res.status(400).json({ success: false, message: "Sorry, your iqama status does not match this job's requirements" });
        }
      }

      // Min experience — blank/non-numeric treated as 0
      if (screening.min_experience) {
        const expYears = parseInt(experience_years) || 0;
        if (expYears < screening.min_experience) {
          return res.status(400).json({ success: false, message: `This job requires at least ${screening.min_experience} years of experience` });
        }
      }

      // Required certifications
      if (screening.required_certs) {
        if (has_certificate !== '1' && has_certificate !== 1) {
          return res.status(400).json({ success: false, message: `This job requires the following certification(s): ${screening.required_certs}. Please confirm you hold these to apply.` });
        }
      }

      // Iqama number required
      if (screening.require_iqama_number && !iqama_number?.trim()) {
        return res.status(400).json({ success: false, message: 'Iqama number is required for this job' });
      }

      // Custom screening questions — all required
      if (screening.custom_questions) {
        try { customQs = JSON.parse(screening.custom_questions); } catch(e) { customQs = []; }
        for (let i = 0; i < customQs.length; i++) {
          const ans = parsedAnswers.find(a => a.q === i);
          if (!ans || !String(ans.answer ?? '').trim()) {
            return res.status(400).json({ success: false, message: `Please answer: "${customQs[i].text}"` });
          }
        }
      }
    }

    // Answers saved in screening_answers column — cover_note is candidate message only
    let fullNote = cover_note || '';

    // Build structured Q&A for grid display
    let sqJson = null;
    if (parsedAnswers && parsedAnswers.length) {
      try {
        const qs = customQs.length ? customQs : [];
        const sq = parsedAnswers.filter(a => a.answer).map(a => ({ q: qs[a.q]?.text || ('Q'+(a.q+1)), a: a.answer }));
        if (sq.length) sqJson = JSON.stringify(sq);
      } catch(e) {}
    }

    const cvUrl = req.file ? '/uploads/cvs/' + req.file.filename : null;
    await db.query(
      `INSERT INTO job_applications
         (job_id, employer_id, full_name, email, phone, whatsapp, nationality,
          iqama_status, iqama_number, experience_years, has_certificate, cover_note, screening_answers,
          cv_url, cv_uploaded_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        job.id, job.employer_id, full_name.trim(),
        email?.trim() || null, phone?.trim() || null,
        whatsapp?.trim() || null, nationality?.trim() || null,
        iqama_status?.trim() || null, iqama_number?.trim() || null,
        parseInt(experience_years) || null,
        has_certificate === '1' || has_certificate === 1 ? 1 : 0,
        fullNote || null, sqJson, cvUrl, cvUrl ? new Date() : null
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

    // Notify the employer of the new application
    try {
      const { sendMail: sendMailEmp } = require('../utils/mailer');
      const [[emp]] = await db.query('SELECT email, contact_name, company_name FROM employers WHERE id = ?', [job.employer_id]);
      if (emp?.email) {
        const base = process.env.NODE_ENV === 'production' ? 'https://joborbit.org' : (process.env.SITE_URL || 'http://localhost:3000');
        const dashLink = `${base}/employer/applications.html`;
        await sendMailEmp({
          to: emp.email,
          subject: `📥 New Application — ${job.title}`,
          html: `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
            <div style="background:#0f62fe;padding:2rem 1.5rem">
              <h1 style="color:#fff;font-size:1.4rem;margin:0;font-weight:800">New Application 📥</h1>
            </div>
            <div style="padding:1.5rem">
              <p style="color:#374151;font-size:.95rem">Hi ${emp.contact_name || emp.company_name || 'there'},</p>
              <p style="color:#374151;font-size:.95rem">You've received a new application for <strong>${job.title}</strong>.</p>
              <div style="background:#f3f4f6;border-radius:10px;padding:1rem 1.25rem;margin:1rem 0">
                <p style="margin:0;font-size:.85rem;color:#6b7280">👤 <strong>Candidate:</strong> ${full_name.trim()}</p>
                ${phone?.trim()    ? `<p style="margin:.4rem 0 0;font-size:.85rem;color:#6b7280">📞 <strong>Phone:</strong> ${phone.trim()}</p>` : ''}
                ${whatsapp?.trim() ? `<p style="margin:.4rem 0 0;font-size:.85rem;color:#6b7280">💬 <strong>WhatsApp:</strong> ${whatsapp.trim()}</p>` : ''}
              </div>
              <p style="margin:1.5rem 0">
                <a href="${dashLink}" style="background:#0f62fe;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                  Review Application →
                </a>
              </p>
              <p style="color:#9ca3af;font-size:.8rem;margin-top:1.5rem">Powered by <a href="${base}" style="color:#0f62fe">JobOrbit.org</a></p>
            </div>
          </div>`
        });
      }
    } catch(notifyErr) {
      console.error('[employer notify email]', notifyErr.message);
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
      SELECT a.full_name, a.nationality, a.iqama_status, a.iqama_number, a.phone, a.whatsapp,
             MAX(a.experience_years)  AS experience_years,
             MAX(a.has_certificate)   AS has_certificate,
             COUNT(DISTINCT a.job_id) AS jobs_applied,
             GROUP_CONCAT(DISTINCT j.title ORDER BY j.title SEPARATOR ' | ') AS jobs_list,
             MAX(a.created_at)        AS last_applied
        FROM job_applications a
        JOIN jobs j ON j.id = a.job_id
       WHERE a.employer_id = ?
       GROUP BY a.full_name, COALESCE(a.phone,''), COALESCE(a.whatsapp,'')
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
    const { data_type, privacy, title, status_filter, expires_days, active_filters, visible_columns } = req.body;
    if (!['jobs','applications','candidates'].includes(data_type))
      return res.status(400).json({ success: false, message: 'Invalid data type' });
    const token   = makeToken();
    const days    = Math.min(parseInt(expires_days) || 30, 365);
    const expires = new Date(Date.now() + days * 86400000);
    const filterObj = {};
    if (status_filter) filterObj.status = [status_filter];
    if (active_filters && typeof active_filters === 'object') {
      Object.entries(active_filters).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) filterObj[k] = v;
      });
    }
    if (visible_columns?.length) filterObj.visible_columns = visible_columns;
    const filters = Object.keys(filterObj).length ? JSON.stringify(filterObj) : null;
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

// GET /api/employer/share/requests  — list all access requests for employer
router.get('/share/requests', requireEmployer, async (req, res) => {
  try {
    const [requests] = await db.query(`
      SELECT sr.id, sr.requester_name, sr.requester_email, sr.status, sr.created_at,
             sv.title, sv.data_type, sv.token, sr.access_token
        FROM share_requests sr
        JOIN shared_views sv ON sv.token = sr.share_token
       WHERE sv.employer_id = ?
       ORDER BY sr.created_at DESC
       LIMIT 50`, [req.employer.id]);
    const pending = requests.filter(r => r.status === 'pending').length;
    res.json({ success: true, requests, pending });
  } catch (err) { res.status(500).json({ success: false }); }
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
      let jw = "WHERE employer_id=?";
      const jp = [share.employer_id];
      const jf = filters.status?.length ? filters.status : ['active'];
      jw += ` AND status IN (${jf.map(()=>'?').join(',')})`;
      jp.push(...jf);
      if (filters.location?.length){ jw+=` AND location IN (${filters.location.map(()=>'?').join(',')})`; jp.push(...filters.location); }
      if (filters.job_type?.length){ jw+=` AND job_type IN (${filters.job_type.map(()=>'?').join(',')})`; jp.push(...filters.job_type); }
      const [rows] = await db.query(
        `SELECT title, company, location, job_type, salary, status, views, created_at
           FROM jobs ${jw} ORDER BY created_at DESC`,
        jp
      );
      data = rows;
    } else if (share.data_type === 'applications') {
      let where = 'WHERE a.employer_id=?';
      const params = [share.employer_id];
      const addF = (field, col) => {
        const vals = filters[field];
        if (vals && Array.isArray(vals) && vals.length) {
          where += ` AND ${col} IN (${vals.map(()=>'?').join(',')})`;
          params.push(...vals);
        }
      };
      addF('status',      'a.status');
      addF('job_title',   'j.title');
      addF('nationality', 'a.nationality');
      addF('iqama_status','a.iqama_status');
      const [rows] = await db.query(
        `SELECT a.full_name, j.title AS job_title, a.status,
                a.nationality, a.iqama_status, a.iqama_number,
                a.experience_years, a.has_certificate,
                a.phone, a.whatsapp, a.cover_note, a.employer_notes,
                a.cv_url, a.created_at
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
      share: { data_type: share.data_type, title: share.title, privacy: share.privacy, created_at: share.created_at, visible_columns: filters.visible_columns||[] },
      data
    });
  } catch (err) { console.error('[share/token]', err); res.status(500).json({ success: false }); }
});

// PUT /api/employer/share/requests/:id  — approve or deny
router.put('/share/requests/:id', requireEmployer, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approve','deny'].includes(action))
      return res.status(400).json({ success: false, message: 'Invalid action' });
    const [[request]] = await db.query(`
      SELECT sr.*, sv.employer_id, sv.title, sv.data_type, sv.token
        FROM share_requests sr
        JOIN shared_views sv ON sv.token = sr.share_token
       WHERE sr.id = ? AND sv.employer_id = ?`, [req.params.id, req.employer.id]);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    const status = action === 'approve' ? 'approved' : 'denied';
    await db.query('UPDATE share_requests SET status=? WHERE id=?', [status, req.params.id]);
    if (action === 'approve') {
      const base = process.env.NODE_ENV === 'production'
        ? 'https://joborbit.org'
        : (process.env.SITE_URL || 'http://localhost:3000');
      const link = `${base}/shared-view.html?token=${request.token}&access=${request.access_token}`;
      const title = request.title || ('Shared ' + request.data_type);
      await sendMail({
        to: request.requester_email,
        subject: `✅ Access Granted — ${title} | JobOrbit`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
          <h2 style="color:#0f62fe;font-size:1.3rem;margin-bottom:.5rem">Access Granted ✅</h2>
          <p>Hi ${request.requester_name || 'there'},</p>
          <p>Your request to access <strong>${title}</strong> has been <strong>approved</strong>.</p>
          <p style="margin:1.5rem 0">
            <a href="${link}" style="background:#0f62fe;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              View Shared Data →
            </a>
          </p>
          <p style="color:#6b7280;font-size:.82rem">This link is personal to you. Do not share it with others.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">
          <p style="color:#9ca3af;font-size:.75rem">Powered by <a href="${base}" style="color:#0f62fe">JobOrbit.org</a></p>
        </div>`
      }).catch(e => console.warn('[share/approve email]', e.message));
    }
    res.json({ success: true });
  } catch (err) { console.error('[share/requests PUT]', err); res.status(500).json({ success: false }); }
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

    // Prevent duplicate requests from the same email spamming the employer
    const [[existingReq]] = await db.query(
      'SELECT id, status FROM share_requests WHERE share_token=? AND LOWER(requester_email)=LOWER(?)',
      [token, email.trim()]
    );
    if (existingReq) {
      return res.json({
        success: true,
        message: existingReq.status === 'approved'
          ? 'You already have access — check your email for the link.'
          : 'You already requested access. The owner has been notified and will respond soon.'
      });
    }

    const accessToken = makeToken();
    await db.query(
      'INSERT INTO share_requests (share_token, requester_email, requester_name, access_token) VALUES (?,?,?,?)',
      [token, email.trim(), name?.trim() || null, accessToken]
    );
    // Notify employer by email
    try {
      const [[emp]] = await db.query(
        'SELECT e.email, sv.title FROM employers e JOIN shared_views sv ON sv.employer_id=e.id WHERE sv.token=?',
        [token]
      );
      if (emp?.email) {
        const base = process.env.NODE_ENV==='production'?'https://joborbit.org':(process.env.SITE_URL||'http://localhost:3000');
        await sendMail({
          to: emp.email,
          subject: `🔔 New Access Request — ${emp.title||'Shared Data'} | JobOrbit`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem"><h2 style="color:#0f62fe">New Access Request</h2><p><strong>${(name||'Someone').trim()}</strong> (${email.trim()}) requested access to: <strong>${emp.title||'Shared Data'}</strong>.</p><p style="margin:1.5rem 0"><a href="${base}/employer/data-grid.html" style="background:#0f62fe;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Review Request in Data Grid →</a></p></div>`
        });
      }
    } catch(e) { console.warn('[share/request notify]', e.message); }
    res.json({ success: true, message: 'Request sent. The employer will review and contact you.' });
  } catch (err) { console.error('[share/request]', err); res.status(500).json({ success: false }); }
});



/* ══════════════════════════════════════════════════════════════
   LOGO UPLOAD
══════════════════════════════════════════════════════════════ */
const multer = require('multer');
const fsSync = require('fs');
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = require('path').join(__dirname, '../../public/uploads/employers');
    fsSync.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'logo-' + req.employer.id + '-' + Date.now() + ext);
  }
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype));
  }
});

router.post('/upload-logo', requireEmployer, logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'Invalid file. Use JPG, PNG or WebP under 2MB.' });
    const logoUrl = '/uploads/employers/' + req.file.filename;
    // Delete old logo file if exists
    const [[emp]] = await db.query('SELECT logo_url FROM employers WHERE id=?', [req.employer.id]);
    if (emp?.logo_url && emp.logo_url.startsWith('/uploads/employers/')) {
      const old = require('path').join(__dirname, '../../public', emp.logo_url);
      if (fsSync.existsSync(old)) fsSync.unlinkSync(old);
    }
    await db.query('UPDATE employers SET logo_url=? WHERE id=?', [logoUrl, req.employer.id]);
    res.json({ success:true, logo_url: logoUrl });
  } catch(err) {
    console.error('[upload-logo]', err);
    res.status(500).json({ success:false, message:'Upload failed' });
  }
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

// POST /api/employer/bulk-jobs
// GET /api/employer/batch/:batchId — fetch a requirement batch for editing
router.get('/batch/:batchId', requireEmployer, async (req, res) => {
  try {
    const [jobs] = await db.query(
      'SELECT * FROM jobs WHERE batch_id=? AND employer_id=? ORDER BY id ASC',
      [req.params.batchId, req.employer.id]
    );
    if (!jobs.length) return res.status(404).json({ success: false, message: 'Batch not found' });
    const j0 = jobs[0];
    const [[sc]] = await db.query('SELECT * FROM job_screening WHERE job_id=?', [j0.id]);

    let customQuestions = [];
    if (sc?.custom_questions) {
      try {
        customQuestions = typeof sc.custom_questions === 'string' ? JSON.parse(sc.custom_questions) : sc.custom_questions;
      } catch (e) { customQuestions = []; }
    }

    res.json({
      success: true,
      common: {
        location: j0.location, job_type: j0.job_type, phone: j0.phone, whatsapp: j0.whatsapp,
        email: j0.email, map_link: j0.map_link, apply_link: j0.apply_link,
        description: j0.description, requirements: j0.requirements, require_cv: j0.require_cv
      },
      screening: sc ? {
        nationalities: sc.nationalities, iqama_types: sc.iqama_types,
        min_experience: sc.min_experience, required_certs: sc.required_certs,
        require_iqama_number: sc.require_iqama_number,
        custom_questions: customQuestions
      } : null,
      jobs: jobs.map(j => ({ id: j.id, title: j.title, positions: j.positions, salary: j.salary, category_id: j.category_id, status: j.status }))
    });
  } catch (err) {
    console.error('[batch GET]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employer/batch/:batchId — update a requirement batch (shared fields + per-job + add/remove)
router.put('/batch/:batchId', requireEmployer, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const { common, jobs, screening } = req.body;
    if (!common?.location?.trim()) return res.status(400).json({ success: false, message: 'Location is required' });

    const validJobs = (jobs || []).filter(j => j.title?.trim());
    if (!validJobs.length) return res.status(400).json({ success: false, message: 'At least one job title is required' });
    if (validJobs.some(j => !j.category_id)) return res.status(400).json({ success: false, message: 'Please select a category for every job' });

    const [existing] = await db.query('SELECT id, created_at, expires_at FROM jobs WHERE batch_id=? AND employer_id=?', [batchId, req.employer.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Batch not found' });
    const existingIds = new Set(existing.map(j => j.id));

    // Default duration for any newly-added positions, based on the batch's original posting duration
    let durationMs = 30 * 86400000;
    const ref = existing[0];
    if (ref.expires_at) {
      const d = new Date(ref.expires_at).getTime() - new Date(ref.created_at).getTime();
      if (d > 0) durationMs = d;
    }

    const [[empRow]] = await db.query('SELECT company_name FROM employers WHERE id = ?', [req.employer.id]);
    const companyName = empRow?.company_name || '';

    const keptIds = [];
    for (const job of validJobs) {
      if (job.id && existingIds.has(job.id)) {
        await db.query(
          `UPDATE jobs SET title=?, positions=?, salary=?, category_id=?,
             location=?, job_type=?, phone=?, whatsapp=?, email=?,
             map_link=?, apply_link=?, description=?, requirements=?, require_cv=?, updated_at=NOW()
           WHERE id=? AND employer_id=?`,
          [
            job.title.trim(), job.positions || 1, job.salary || null, job.category_id,
            common.location, common.job_type || 'Contract', common.phone || null, common.whatsapp || null, common.email || null,
            common.map_link || null, common.apply_link || null, common.description || null, common.requirements || null, common.require_cv ? 1 : 0,
            job.id, req.employer.id
          ]
        );
        keptIds.push(job.id);
      } else {
        const slug = slugify(job.title.trim()) + '-' + Date.now() + Math.floor(Math.random() * 1000);
        const expiresAt = new Date(Date.now() + durationMs);
        const [result] = await db.query(
          `INSERT INTO jobs
             (employer_id, company, title, category_id, location, job_type, positions,
              phone, whatsapp, email, salary, description, requirements, require_cv,
              apply_link, map_link, status, slug, expires_at, posted_by, batch_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,'employer',?)`,
          [
            req.employer.id, companyName, job.title.trim(),
            job.category_id, common.location,
            common.job_type || 'Contract', job.positions || 1,
            common.phone || null, common.whatsapp || null, common.email || null,
            job.salary || null, common.description || null,
            common.requirements || null, common.require_cv ? 1 : 0,
            common.apply_link || null, common.map_link || null,
            slug, expiresAt, batchId
          ]
        );
        keptIds.push(result.insertId);
      }
    }

    // Close positions removed from the batch (preserve their applications, don't delete)
    const toClose = existing.filter(j => !keptIds.includes(j.id)).map(j => j.id);
    if (toClose.length) {
      await db.query(
        `UPDATE jobs SET status='closed' WHERE employer_id=? AND id IN (${toClose.map(() => '?').join(',')})`,
        [req.employer.id, ...toClose]
      );
    }

    // Sync screening filters across all kept/new jobs in the batch
    if (screening) {
      for (const id of keptIds) {
        await db.query(
          `INSERT INTO job_screening (job_id, nationalities, iqama_types, min_experience, required_certs, custom_questions, require_iqama_number)
           VALUES (?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             nationalities=VALUES(nationalities), iqama_types=VALUES(iqama_types),
             min_experience=VALUES(min_experience), required_certs=VALUES(required_certs),
             custom_questions=VALUES(custom_questions), require_iqama_number=VALUES(require_iqama_number)`,
          [id, screening.nationalities || null, screening.iqama_types || null,
           screening.min_experience != null ? screening.min_experience : null,
           screening.required_certs || null,
           screening.custom_questions?.length ? JSON.stringify(screening.custom_questions) : null,
           screening.require_iqama_number ? 1 : 0]
        );
      }
    } else if (keptIds.length) {
      await db.query(`DELETE FROM job_screening WHERE job_id IN (${keptIds.map(() => '?').join(',')})`, keptIds);
    }

    res.json({ success: true, message: 'Requirement batch updated', closed: toClose.length });
  } catch (err) {
    console.error('[batch PUT]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/bulk-jobs', requireEmployer, async (req, res) => {
  try {
    const { jobs, common } = req.body;
    if (!jobs?.length)     return res.status(400).json({ success:false, message:'No jobs provided' });
    if (!common?.location) return res.status(400).json({ success:false, message:'Location is required' });

    const [[empRow]] = await db.query('SELECT company_name FROM employers WHERE id = ?', [req.employer.id]);
    const companyName = empRow?.company_name || '';
    const batchId = require('crypto').randomBytes(16).toString('hex');
    const expMins = common.expiry_unit === 'hours'
      ? (common.expiry_num * 60)
      : (common.expiry_num * 24 * 60);
    const expiresAt = new Date(Date.now() + expMins * 60 * 1000);

    let created = 0;
    let skipped = 0;
    for (const job of jobs) {
      if (!job.title?.trim()) continue;
      const catId = job.category_id || common.category_id || null;
      if (!catId) { skipped++; continue; } // no category resolvable — skip to avoid invisible job
      try {
        const slug = slugify(job.title.trim()) + '-' + Date.now() + Math.floor(Math.random()*1000);
        const desc  = [common.description, job.note ? 'Note: ' + job.note : ''].filter(Boolean).join('\n\n') || null;
        const [result] = await db.query(
          `INSERT INTO jobs
             (employer_id, company, title, category_id, location, job_type, positions,
              phone, whatsapp, email, salary, description, requirements, require_cv,
              apply_link, map_link, status, slug, expires_at, posted_by, batch_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,'employer',?)`,
          [
            req.employer.id, companyName, job.title.trim(),
            catId, common.location,
            common.job_type || 'Contract', job.positions || 1,
            common.phone || null, common.whatsapp || null, common.email || null,
            job.salary || null, desc,
            common.requirements || null, common.require_cv ? 1 : 0,
            common.apply_link || null, common.map_link || null,
            slug, expiresAt, batchId
          ]
        );
        if (common.screening && result.insertId) {
          const sc = common.screening;
          try {
            await db.query(
              `INSERT INTO job_screening
                 (job_id, nationalities, iqama_types, min_experience, required_certs, custom_questions, require_iqama_number)
               VALUES (?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE
                 nationalities=VALUES(nationalities), iqama_types=VALUES(iqama_types),
                 min_experience=VALUES(min_experience), required_certs=VALUES(required_certs),
                 require_iqama_number=VALUES(require_iqama_number)`,
              [result.insertId, sc.nationalities||null, sc.iqama_types||null,
               sc.min_experience!=null ? sc.min_experience : null,
               sc.required_certs||null,
               sc.custom_questions?.length ? JSON.stringify(sc.custom_questions) : null,
               sc.require_iqama_number||0]
            );
          } catch(se) { console.error('[bulk screening]', se.message); }
        }
        created++;
      } catch(e) { console.error('[bulk-jobs row]', e.message); }
    }

    res.json({ success: true, created, batch_id: batchId });
  } catch (err) {
    console.error('[bulk-jobs]', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
