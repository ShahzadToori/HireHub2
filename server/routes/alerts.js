/**
 * alerts.js — Job Alert Routes for JobOrbit
 * ─────────────────────────────────────────────────────────────
 *  POST /api/alerts/subscribe          Save email + send confirmation
 *  GET  /api/alerts/confirm/:token     Activate subscription
 *  GET  /api/alerts/unsubscribe/:token One-click unsubscribe
 *  POST /api/alerts/send-digest        Admin trigger: send matching alerts
 *  GET  /api/admin/alerts              Admin: list all subscribers
 *  DELETE /api/admin/alerts/:id        Admin: delete a subscriber
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express  = require('express');
const crypto   = require('crypto');
const db       = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const { sendMail, confirmationEmail, jobAlertEmail, SITE_URL, SITE_NAME } = require('../utils/mailer');

const router = express.Router();

// ── Rate limiting for subscribe endpoint ──────────────────────
const subscribeAttempts = new Map(); // simple in-memory rate limit

function alertRateLimit(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const win = 60 * 60 * 1000; // 1 hour window
  const max = 5;               // max 5 subscriptions per IP per hour

  const entry = subscribeAttempts.get(ip) || { count: 0, start: now };
  if (now - entry.start > win) {
    subscribeAttempts.set(ip, { count: 1, start: now });
    return next();
  }
  if (entry.count >= max) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }
  entry.count++;
  subscribeAttempts.set(ip, entry);
  next();
}

// Clean up rate limit map every hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [ip, entry] of subscribeAttempts) {
    if (entry.start < cutoff) subscribeAttempts.delete(ip);
  }
}, 60 * 60 * 1000);


/* ══════════════════════════════════════════════════════════════
   POST /api/alerts/subscribe
   Body: { email, category?, city?, channel? }
══════════════════════════════════════════════════════════════ */
router.post('/subscribe', alertRateLimit, async (req, res) => {
  try {
    let { email, category, city, channel = 'email' } = req.body;

    // ── Validate ──────────────────────────────────────────────
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    email = email.trim().toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email) || email.length > 160) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    category = category?.trim() || null;
    city     = city?.trim()     || null;
    channel  = ['email', 'whatsapp', 'telegram'].includes(channel) ? channel : 'email';

    // ── Check if already subscribed ───────────────────────────
    const [existing] = await db.query(
      'SELECT id, confirmed FROM job_alerts WHERE email = ? AND channel = ? LIMIT 1',
      [email, channel]
    );

    if (existing.length > 0) {
      const sub = existing[0];

      if (sub.confirmed) {
        // Already confirmed — update preferences silently
        await db.query(
          'UPDATE job_alerts SET category = ?, city = ?, updated_at = NOW() WHERE id = ?',
          [category, city, sub.id]
        );
        return res.json({ success: true, message: 'Your alert preferences have been updated!' });
      } else {
        // Exists but not confirmed — resend confirmation
        const [[tokenRow]] = await db.query('SELECT token FROM job_alerts WHERE id = ?', [sub.id]);
        const confirmUrl = `${SITE_URL}/api/alerts/confirm/${tokenRow.token}`;
        const tmpl = confirmationEmail({ confirmUrl, category, city });
        await sendMail({ to: email, ...tmpl }).catch(e => console.warn('[alerts] Confirm email failed:', e.message));
        return res.json({ success: true, message: 'Confirmation email resent — please check your inbox.' });
      }
    }

    // ── Generate unique token ─────────────────────────────────
    const token = crypto.randomBytes(32).toString('hex');

    // ── Save to DB ────────────────────────────────────────────
    await db.query(
      `INSERT INTO job_alerts (email, category, city, channel, token, confirmed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [email, category, city, channel, token]
    );

    // ── Send confirmation email ───────────────────────────────
    const confirmUrl = `${SITE_URL}/api/alerts/confirm/${token}`;
    const tmpl = confirmationEmail({ confirmUrl, category, city });

    await sendMail({ to: email, ...tmpl })
      .catch(e => console.warn('[alerts] Confirmation email failed:', e.message));

    res.json({
      success: true,
      message: 'Almost done! Check your email and click the confirmation link to activate your alerts.'
    });

  } catch (err) {
    console.error('[alerts] Subscribe error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});


/* ══════════════════════════════════════════════════════════════
   GET /api/alerts/confirm/:token
   Activates the subscription — renders a success HTML page
══════════════════════════════════════════════════════════════ */
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) return res.status(400).send(resultPage('Invalid link.', false));

    const [rows] = await db.query(
      'SELECT id, email, category, city, confirmed FROM job_alerts WHERE token = ? LIMIT 1',
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).send(resultPage('This link is invalid or has expired.', false));
    }

    const sub = rows[0];

    if (!sub.confirmed) {
      await db.query('UPDATE job_alerts SET confirmed = 1, updated_at = NOW() WHERE id = ?', [sub.id]);
    }

    const prefs = [
      sub.category && `Category: <strong>${esc(sub.category)}</strong>`,
      sub.city     && `City: <strong>${esc(sub.city)}</strong>`
    ].filter(Boolean);

    const detail = prefs.length
      ? `<p style="color:#475569;font-size:.9rem">Your preferences: ${prefs.join(' · ')}</p>`
      : '<p style="color:#475569;font-size:.9rem">You will receive alerts for all new job listings.</p>';

    const unsubUrl = `${SITE_URL}/api/alerts/unsubscribe/${token}`;

    res.send(resultPage(
      `🎉 You're subscribed!`,
      true,
      `<p style="color:#475569;margin:.5rem 0 1rem">Job alerts are now active for <strong>${esc(sub.email)}</strong>.</p>
       ${detail}
       <p style="margin-top:1.5rem">
         <a href="${SITE_URL}" style="display:inline-block;background:#0f62fe;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:.9rem">Browse Jobs Now →</a>
       </p>
       <p style="margin-top:1.25rem;font-size:.78rem;color:#94a3b8">
         Changed your mind? <a href="${unsubUrl}" style="color:#94a3b8">Unsubscribe</a>
       </p>`
    ));

  } catch (err) {
    console.error('[alerts] Confirm error:', err);
    res.status(500).send(resultPage('Something went wrong. Please try again.', false));
  }
});


/* ══════════════════════════════════════════════════════════════
   GET /api/alerts/unsubscribe/:token
   Removes the subscription — renders a confirmation page
══════════════════════════════════════════════════════════════ */
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) return res.status(400).send(resultPage('Invalid link.', false));

    const [rows] = await db.query(
      'SELECT id, email FROM job_alerts WHERE token = ? LIMIT 1',
      [token]
    );

    if (rows.length === 0) {
      return res.send(resultPage('Already unsubscribed or link invalid.', true));
    }

    await db.query('DELETE FROM job_alerts WHERE id = ?', [rows[0].id]);

    res.send(resultPage(
      'Unsubscribed',
      true,
      `<p style="color:#475569;font-size:.9rem;margin:.5rem 0 1.5rem">
         <strong>${esc(rows[0].email)}</strong> has been removed from all job alerts.
       </p>
       <a href="${SITE_URL}" style="display:inline-block;background:#f1f5f9;color:#0f62fe;padding:11px 26px;border-radius:10px;font-weight:700;text-decoration:none;font-size:.88rem;border:1px solid #e2e8f0">
         Back to ${SITE_NAME}
       </a>`
    ));

  } catch (err) {
    console.error('[alerts] Unsubscribe error:', err);
    res.status(500).send(resultPage('Something went wrong.', false));
  }
});


/* ══════════════════════════════════════════════════════════════
   POST /api/alerts/send-digest    (admin only)
   Finds jobs posted in the last N hours and emails subscribers
   Body: { hours? }  — default 24
══════════════════════════════════════════════════════════════ */
router.post('/send-digest', requireAdmin, async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.body?.hours) || 24, 168); // max 1 week

    // ── Fetch new jobs ─────────────────────────────────────────
    const [newJobs] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.job_type,
              j.description, j.slug, j.created_at,
              c.name AS category, c.slug AS category_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.status = 'active'
          AND j.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        ORDER BY j.created_at DESC`,
      [hours]
    );

    if (newJobs.length === 0) {
      return res.json({ success: true, message: 'No new jobs in that period. No emails sent.', sent: 0 });
    }

    // ── Fetch confirmed subscribers ────────────────────────────
    const [subscribers] = await db.query(
      "SELECT id, email, category, city, token FROM job_alerts WHERE confirmed = 1 AND channel = 'email'"
    );

    if (subscribers.length === 0) {
      return res.json({ success: true, message: 'No confirmed subscribers yet.', sent: 0 });
    }

    let sent = 0;
    const errors = [];

    for (const sub of subscribers) {
      // ── Match jobs to this subscriber's preferences ──────────
      const matched = newJobs.filter(j => {
        const catMatch = !sub.category ||
          j.category.toLowerCase().includes(sub.category.toLowerCase()) ||
          j.category_slug === sub.category;
        const cityMatch = !sub.city ||
          j.location.toLowerCase().includes(sub.city.toLowerCase());
        return catMatch && cityMatch;
      });

      if (matched.length === 0) continue;

      const unsubUrl = `${SITE_URL}/api/alerts/unsubscribe/${sub.token}`;
      const tmpl = jobAlertEmail({
        jobs:           matched,
        category:       sub.category,
        city:           sub.city,
        unsubscribeUrl: unsubUrl
      });

      try {
        await sendMail({ to: sub.email, ...tmpl });
        sent++;
        // Small delay to avoid SMTP rate limits
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        errors.push({ email: sub.email, error: e.message });
        console.warn(`[alerts] Failed to send to ${sub.email}:`, e.message);
      }
    }

    res.json({
      success: true,
      message: `Digest sent to ${sent} subscriber${sent !== 1 ? 's' : ''}.`,
      sent,
      newJobs: newJobs.length,
      subscribers: subscribers.length,
      errors: errors.length ? errors : undefined
    });

  } catch (err) {
    console.error('[alerts] Send-digest error:', err);
    res.status(500).json({ success: false, message: 'Server error during digest send.' });
  }
});


/* ══════════════════════════════════════════════════════════════
   GET /api/admin/alerts    Admin: list subscribers
══════════════════════════════════════════════════════════════ */
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const perPage = Math.min(parseInt(limit) || 50, 200);
    const offset  = (parseInt(page) - 1) * perPage;

    const [[{ total }]]   = await db.query('SELECT COUNT(*) AS total FROM job_alerts');
    const [[{ confirmed }]] = await db.query('SELECT COUNT(*) AS confirmed FROM job_alerts WHERE confirmed = 1');
    const [subscribers]   = await db.query(
      `SELECT id, email, category, city, channel, confirmed, created_at
         FROM job_alerts ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [perPage, offset]
    );

    res.json({ success: true, total, confirmed, page: parseInt(page), perPage, subscribers });
  } catch (err) {
    console.error('[alerts] List error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


/* ══════════════════════════════════════════════════════════════
   DELETE /api/alerts/delete/:id    Admin: remove subscriber
══════════════════════════════════════════════════════════════ */
router.delete('/delete/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM job_alerts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


/* ══════════════════════════════════════════════════════════════
   AUTO-DIGEST: runs once daily on server start
   Sends alerts for jobs posted in last 24 hours
══════════════════════════════════════════════════════════════ */
function scheduleAutoDigest() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function runDigest() {
    try {
      const [newJobs] = await db.query(
        `SELECT j.id, j.title, j.company, j.location, j.job_type,
                j.description, j.slug, j.created_at,
                c.name AS category, c.slug AS category_slug
           FROM jobs j
           JOIN categories c ON j.category_id = c.id
          WHERE j.status = 'active'
            AND j.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          ORDER BY j.created_at DESC`
      );

      if (newJobs.length === 0) return;

      const [subscribers] = await db.query(
        "SELECT id, email, category, city, token FROM job_alerts WHERE confirmed = 1 AND channel = 'email'"
      );

      let sent = 0;
      for (const sub of subscribers) {
        const matched = newJobs.filter(j => {
          const catMatch  = !sub.category || j.category.toLowerCase().includes(sub.category.toLowerCase()) || j.category_slug === sub.category;
          const cityMatch = !sub.city     || j.location.toLowerCase().includes(sub.city.toLowerCase());
          return catMatch && cityMatch;
        });
        if (matched.length === 0) continue;

        const unsubUrl = `${SITE_URL}/api/alerts/unsubscribe/${sub.token}`;
        const tmpl = jobAlertEmail({ jobs: matched, category: sub.category, city: sub.city, unsubscribeUrl: unsubUrl });
        await sendMail({ to: sub.email, ...tmpl }).catch(e => console.warn('[auto-digest] Mail failed:', e.message));
        sent++;
        await new Promise(r => setTimeout(r, 150));
      }

      if (sent > 0) console.log(`[auto-digest] ✓ Sent to ${sent} subscriber${sent !== 1 ? 's' : ''} — ${newJobs.length} new job${newJobs.length !== 1 ? 's' : ''}`);
    } catch (e) {
      console.error('[auto-digest] Error:', e.message);
    }
  }

  // Run once after 5 min delay (lets server fully start), then every 24h
  setTimeout(() => {
    runDigest();
    setInterval(runDigest, INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log('📧  Job alert auto-digest scheduled (every 24h)');
}

// ── Simple HTML page renderer ──────────────────────────────────
function resultPage(heading, success, bodyHtml = '') {
  const color = success ? '#059669' : '#dc2626';
  const icon  = success ? '✓' : '✗';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${heading} – ${SITE_NAME}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:3rem 2.5rem;max-width:460px;width:100%;text-align:center}
    .icon{width:64px;height:64px;border-radius:50%;background:${success ? 'rgba(5,150,105,.1)' : 'rgba(220,38,38,.1)'};display:inline-flex;align-items:center;justify-content:center;font-size:1.75rem;color:${color};margin-bottom:1.25rem}
    h1{font-size:1.4rem;font-weight:800;color:#0f172a;margin-bottom:.5rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

module.exports = { router, scheduleAutoDigest };
