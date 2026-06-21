'use strict';

const express    = require('express');
const router     = express.Router();
const db         = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const { sendMail }     = require('../utils/mailer');

router.use(requireAdmin);

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://joborbit.org'
  : (process.env.SITE_URL || 'http://localhost:3000');

// ── GET /api/admin/employers ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { q, status, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(parseInt(limit) || 20, 100);
    const offset  = (parseInt(page) - 1) * perPage;

    let where  = ['e.status != "deleted"'];
    let params = [];

    if (q) {
      where.push('(e.company_name LIKE ? OR e.email LIKE ? OR e.contact_name LIKE ? OR e.cr_number LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status && ['pending','active','suspended'].includes(status)) {
      where.push('e.status = ?');
      params.push(status);
    }

    const whereSql = 'WHERE ' + where.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM employers e ${whereSql}`,
      params
    );

    const [employers] = await db.query(
      `SELECT e.id, e.company_name, e.contact_name, e.email, e.phone,
              e.sector, e.city, e.status, e.cr_number, e.logo_url,
              e.created_at, e.last_login, e.email_verified,
              COUNT(j.id) AS total_jobs,
              SUM(CASE WHEN j.status = 'active' THEN 1 ELSE 0 END) AS active_jobs
         FROM employers e
         LEFT JOIN jobs j ON j.employer_id = e.id AND j.status NOT IN ('deleted','closed')
       ${whereSql}
         GROUP BY e.id
         ORDER BY
           CASE e.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
           e.created_at DESC
         LIMIT ${perPage} OFFSET ${offset}`,
      params
    );

    const [[{ pendingCount }]] = await db.query(
      "SELECT COUNT(*) AS pendingCount FROM employers WHERE status = 'pending'"
    );

    res.json({ success: true, total, page: parseInt(page), perPage, pages: Math.ceil(total / perPage), pendingCount, employers });
  } catch (err) {
    console.error('[admin/employers GET]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/admin/employers/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [[emp]] = await db.query(
      `SELECT e.id, e.company_name, e.contact_name, e.email, e.phone, e.whatsapp,
              e.sector, e.city, e.about, e.website, e.address, e.logo_url,
              e.status, e.cr_number, e.linkedin_url, e.founded_year,
              e.company_size, e.created_at, e.last_login, e.email_verified,
              e.admin_notes
         FROM employers e WHERE e.id = ?`,
      [req.params.id]
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employer not found' });

    const [[{ total_jobs }]]        = await db.query("SELECT COUNT(*) AS total_jobs FROM jobs WHERE employer_id = ? AND status != 'deleted'", [req.params.id]);
    const [[{ active_jobs }]]       = await db.query("SELECT COUNT(*) AS active_jobs FROM jobs WHERE employer_id = ? AND status = 'active'", [req.params.id]);
    const [[{ total_applications }]]= await db.query('SELECT COUNT(*) AS total_applications FROM job_applications WHERE employer_id = ?', [req.params.id]);

    res.json({ success: true, employer: emp, stats: { total_jobs, active_jobs, total_applications } });
  } catch (err) {
    console.error('[admin/employers/:id GET]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PATCH /api/admin/employers/:id/status ────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','suspended','deleted'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [[emp]] = await db.query(
      'SELECT id, company_name, contact_name, email FROM employers WHERE id = ?',
      [req.params.id]
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employer not found' });

    if (status === 'deleted') {
      await db.query("UPDATE jobs SET status = 'closed' WHERE employer_id = ? AND status = 'active'", [req.params.id]);
      await db.query('DELETE FROM employer_sessions WHERE employer_id = ?', [req.params.id]);
      await db.query('DELETE FROM employers WHERE id = ?', [req.params.id]);
    } else {
      await db.query('UPDATE employers SET status = ? WHERE id = ?', [status, req.params.id]);
      if (status === 'suspended') {
        await db.query('DELETE FROM employer_sessions WHERE employer_id = ?', [req.params.id]);
      }
    }

    // Fire-and-forget emails — don't block the response
    if (status === 'active') {
      sendMail({
        to: emp.email,
        subject: 'Your JobOrbit Employer Account is Approved!',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
          <h2 style="color:#16a34a;margin-bottom:.5rem">Account Approved!</h2>
          <p>Hi ${emp.contact_name || emp.company_name},</p>
          <p>Your JobOrbit employer account has been approved. You can now log in and start posting jobs.</p>
          <p style="margin:1.5rem 0">
            <a href="${BASE_URL}/employer/" style="display:inline-block;background:#0f62fe;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600">
              Log In to Your Account
            </a>
          </p>
          <p style="color:#9ca3af;font-size:.75rem">JobOrbit.org</p>
        </div>`
      }).catch(e => console.error('[employer approve email]', e.message));
    } else if (status === 'suspended') {
      sendMail({
        to: emp.email,
        subject: 'Your JobOrbit Account Has Been Suspended',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
          <h2 style="color:#dc2626;margin-bottom:.5rem">Account Suspended</h2>
          <p>Hi ${emp.contact_name || emp.company_name},</p>
          <p>Your JobOrbit employer account has been suspended. Reply to this email if you believe this is a mistake.</p>
          <p style="color:#9ca3af;font-size:.75rem">JobOrbit.org</p>
        </div>`
      }).catch(e => console.error('[employer suspend email]', e.message));
    }

    const label = status === 'deleted' ? 'deleted' : status === 'active' ? 'approved' : 'suspended';
    res.json({ success: true, message: `Employer ${label} successfully` });
  } catch (err) {
    console.error('[admin/employers/:id/status]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PATCH /api/admin/employers/:id/notes ─────────────────────────
router.patch('/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    await db.query('UPDATE employers SET admin_notes = ? WHERE id = ?', [notes || null, req.params.id]);
    res.json({ success: true, message: 'Notes saved' });
  } catch (err) {
    console.error('[admin/employers/:id/notes]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/admin/employers/:id/email ──────────────────────────
// Fire-and-forget — responds immediately, email delivers in background
router.post('/:id/email', async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject?.trim()) return res.status(400).json({ success: false, message: 'Subject is required' });
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    const [[emp]] = await db.query(
      'SELECT company_name, contact_name, email FROM employers WHERE id = ?',
      [req.params.id]
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employer not found' });

    // Respond immediately — SMTP can be slow on mobile networks
    res.json({ success: true, message: 'Email sent — may take a minute to arrive' });

    // Send in background after response
    sendMail({
      to: emp.email,
      subject: subject.trim(),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem">
        <h2 style="color:#0f62fe;margin-bottom:.5rem">Message from JobOrbit</h2>
        <p>Hi ${emp.contact_name || emp.company_name},</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem 1.25rem;margin:1rem 0;line-height:1.75;color:#374151">
          ${message.trim().replace(/\n/g, '<br>')}
        </div>
        <p style="color:#9ca3af;font-size:.75rem">JobOrbit.org</p>
      </div>`
    }).catch(e => console.error('[admin send email]', e.message));

  } catch (err) {
    console.error('[admin/employers/:id/email]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
