/**
 * mailer.js — Reusable email sender for JobOrbit
 * ─────────────────────────────────────────────────────────────
 * Uses nodemailer with SMTP (works with Gmail, Outlook, any SMTP)
 *
 * Required .env variables:
 *   MAIL_HOST=smtp.gmail.com
 *   MAIL_PORT=587
 *   MAIL_SECURE=false          (true for port 465)
 *   MAIL_USER=your@gmail.com
 *   MAIL_PASS=your-app-password
 *   MAIL_FROM=JobOrbit <alerts@joborbit.org>
 *   SITE_URL=https://joborbit.org
 *   SITE_NAME=JobOrbit
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const nodemailer = require('nodemailer');

// ── Transporter (created once, reused) ────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_SECURE === 'true',   // true = port 465
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || ''
  },
  tls: { rejectUnauthorized: false }            // allows self-signed certs in dev
});

const FROM      = process.env.MAIL_FROM || `"${process.env.SITE_NAME || 'JobOrbit'}" <${process.env.MAIL_USER}>`;
const SITE_URL  = (process.env.SITE_URL || 'https://joborbit.org').replace(/\/$/, '');
const SITE_NAME = process.env.SITE_NAME || 'JobOrbit';

// ── Base email wrapper ─────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn('[mailer] MAIL_USER or MAIL_PASS not set — email not sent');
    return;
  }
  return transporter.sendMail({ from: FROM, to, subject, html, text });
}

// ── Shared email shell (header + footer) ──────────────────────
function emailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${SITE_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d1117 0%,#0f2744 100%);padding:28px 32px;text-align:center">
            <a href="${SITE_URL}" style="font-family:'Segoe UI',sans-serif;font-size:1.4rem;font-weight:800;color:#fff;text-decoration:none;letter-spacing:-.5px">
              ${SITE_NAME}
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px 32px 24px">${bodyHtml}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
              You are receiving this because you subscribed to job alerts on
              <a href="${SITE_URL}" style="color:#0f62fe;text-decoration:none">${SITE_NAME}</a>.<br>
              © ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email templates ────────────────────────────────────────────

/**
 * Confirmation email sent when user subscribes
 */
function confirmationEmail({ confirmUrl, category, city }) {
  const prefs = [
    category && `Category: <strong>${category}</strong>`,
    city     && `City: <strong>${city}</strong>`
  ].filter(Boolean);

  const body = `
    <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#0f172a">Confirm your job alerts</h2>
    <p style="margin:0 0 20px;font-size:.95rem;color:#475569;line-height:1.65">
      You're almost done! Click the button below to activate your job alerts on ${SITE_NAME}.
    </p>

    ${prefs.length ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0;font-size:.85rem;color:#64748b">Your alert preferences:<br>
        ${prefs.join(' &nbsp;·&nbsp; ')}
      </p>
    </div>` : ''}

    <div style="text-align:center;margin:28px 0">
      <a href="${confirmUrl}"
         style="display:inline-block;background:#0f62fe;color:#fff;font-weight:700;font-size:.95rem;
                text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px">
        ✓ Confirm My Alerts
      </a>
    </div>

    <p style="margin:0;font-size:.8rem;color:#94a3b8;text-align:center">
      Button not working? Copy this link:<br>
      <a href="${confirmUrl}" style="color:#0f62fe;word-break:break-all">${confirmUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:.8rem;color:#94a3b8;text-align:center">
      If you did not request this, you can safely ignore this email.
    </p>`;

  return {
    subject: `Confirm your job alerts – ${SITE_NAME}`,
    html:    emailShell(body),
    text:    `Confirm your job alerts on ${SITE_NAME}\n\nClick here: ${confirmUrl}\n\nIf you did not request this, ignore this email.`
  };
}

/**
 * Job alert digest — sent when new matching jobs are found
 */
function jobAlertEmail({ jobs, category, city, unsubscribeUrl }) {
  const count    = jobs.length;
  const catLabel = category || 'All Categories';
  const locLabel = city     || 'All Locations';

  const jobCards = jobs.map(j => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:12px">
      <p style="margin:0 0 4px;font-size:1rem;font-weight:700;color:#0f172a">${esc(j.title)}</p>
      <p style="margin:0 0 8px;font-size:.85rem;color:#64748b">
        🏢 ${esc(j.company)} &nbsp;·&nbsp; 📍 ${esc(j.location)} &nbsp;·&nbsp; 💼 ${esc(j.job_type || 'Full-time')}
      </p>
      <p style="margin:0 0 12px;font-size:.83rem;color:#475569;line-height:1.6">
        ${esc(j.description.replace(/\n/g, ' ').substring(0, 180))}${j.description.length > 180 ? '…' : ''}
      </p>
      <a href="${SITE_URL}/job/${j.slug}"
         style="display:inline-block;background:#0f62fe;color:#fff;font-weight:600;font-size:.82rem;
                text-decoration:none;padding:9px 22px;border-radius:8px">
        View Job →
      </a>
    </div>`).join('');

  const body = `
    <h2 style="margin:0 0 6px;font-size:1.25rem;font-weight:800;color:#0f172a">
      ${count} new job${count > 1 ? 's' : ''} matching your alert
    </h2>
    <p style="margin:0 0 24px;font-size:.88rem;color:#64748b">
      ${catLabel} &nbsp;·&nbsp; ${locLabel}
    </p>

    ${jobCards}

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${SITE_URL}"
         style="display:inline-block;background:#f1f5f9;color:#0f62fe;font-weight:700;font-size:.875rem;
                text-decoration:none;padding:12px 30px;border-radius:10px;border:1px solid #e2e8f0">
        Browse All Jobs on ${SITE_NAME}
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:.75rem;color:#94a3b8;text-align:center">
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe from alerts</a>
    </p>`;

  return {
    subject: `${count} new ${catLabel} job${count > 1 ? 's' : ''} – ${SITE_NAME}`,
    html:    emailShell(body),
    text:    `${count} new job${count > 1 ? 's' : ''} on ${SITE_NAME}\n\n` +
             jobs.map(j => `${j.title} at ${j.company} — ${SITE_URL}/job/${j.slug}`).join('\n') +
             `\n\nUnsubscribe: ${unsubscribeUrl}`
  };
}

/** Simple HTML escape for email content */
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { sendMail, confirmationEmail, jobAlertEmail, SITE_URL, SITE_NAME };
