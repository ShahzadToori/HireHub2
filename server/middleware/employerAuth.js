'use strict';
const db = require('../db/connection');

async function requireEmployer(req, res, next) {
  try {
    const token = req.cookies?.emp_token || req.headers['x-employer-token'];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const [[session]] = await db.query(
      `SELECT es.employer_id, es.remember_me, es.expires_at,
              e.id, e.company_name, e.email, e.status, e.contact_name
         FROM employer_sessions es
         JOIN employers e ON e.id = es.employer_id
        WHERE es.token = ? AND es.expires_at > NOW() AND e.status = 'active'
        LIMIT 1`,
      [token]
    );

    if (!session) return res.status(401).json({ success: false, message: 'Session expired' });

    // Sliding session — extend on activity
    if (session.remember_me) {
      // Remember me: extend by 30 days from now
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.query(
        'UPDATE employer_sessions SET expires_at = ?, last_activity = NOW() WHERE token = ?',
        [newExpiry, token]
      );
      res.cookie('emp_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
    } else {
      // No remember me: update last activity only
      await db.query(
        'UPDATE employer_sessions SET last_activity = NOW() WHERE token = ?',
        [token]
      );
    }

    req.employer = session;
    next();
  } catch (err) {
    console.error('[employerAuth]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { requireEmployer };
