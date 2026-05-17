/**
 * reviews.js — Employer Review System
 * ─────────────────────────────────────────────────────────────
 * POST /api/reviews          Submit an anonymous employer review
 * GET  /api/reviews/:company Get reviews for a specific company
 * GET  /api/admin/reviews    Admin: list all reviews (paginated)
 * PUT  /api/admin/reviews/:id/approve  Admin: approve a review
 * DELETE /api/admin/reviews/:id        Admin: delete a review
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const db      = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

const router  = express.Router();

/* ── Simple rate limit (in-memory) ───────────────────────────── */
const reviewAttempts = new Map();
function reviewRateLimit(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const win = 60 * 60 * 1000; // 1 hour
  const max = 3;               // max 3 reviews per IP per hour
  const entry = reviewAttempts.get(ip) || { count: 0, start: now };
  if (now - entry.start > win) { reviewAttempts.set(ip, { count: 1, start: now }); return next(); }
  if (entry.count >= max) return res.status(429).json({ success: false, message: 'Too many reviews submitted. Please try again later.' });
  entry.count++;
  reviewAttempts.set(ip, entry);
  next();
}

/* ══════════════════════════════════════════════════════════════
   POST /api/reviews   – Submit anonymous review
══════════════════════════════════════════════════════════════ */
router.post('/', reviewRateLimit, async (req, res) => {
  try {
    const {
      company_name,
      job_title,
      rating_overall,   // 1–5
      rating_salary,    // 1–5 (salary paid on time)
      rating_iqama,     // 1–5 (iqama processed properly)
      rating_recommend, // 1–5 (recommend to expat)
      review_text,
      worked_from,      // year e.g. 2022
      worked_to,        // year e.g. 2024 or 'present'
      nationality       // optional
    } = req.body;

    // Validate
    if (!company_name?.trim()) return res.status(400).json({ success: false, message: 'Company name is required.' });
    if (!rating_overall || rating_overall < 1 || rating_overall > 5) return res.status(400).json({ success: false, message: 'Overall rating (1–5) is required.' });
    if (!review_text?.trim() || review_text.trim().length < 30) return res.status(400).json({ success: false, message: 'Review must be at least 30 characters.' });

    // Basic spam filter
    const spamWords = ['http://', 'https://', 'www.', 'click here', 'buy now', 'free money'];
    if (spamWords.some(w => review_text.toLowerCase().includes(w))) {
      return res.status(400).json({ success: false, message: 'Review contains invalid content.' });
    }

    await db.query(
      `INSERT INTO employer_reviews
         (company_name, job_title, rating_overall, rating_salary, rating_iqama,
          rating_recommend, review_text, worked_from, worked_to, nationality,
          approved, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,NOW())`,
      [
        company_name.trim().substring(0, 100),
        job_title?.trim()?.substring(0, 100) || null,
        parseInt(rating_overall),
        rating_salary  ? parseInt(rating_salary)  : null,
        rating_iqama   ? parseInt(rating_iqama)   : null,
        rating_recommend ? parseInt(rating_recommend) : null,
        review_text.trim().substring(0, 2000),
        worked_from ? parseInt(worked_from) : null,
        worked_to?.trim()?.substring(0, 10) || null,
        nationality?.trim()?.substring(0, 50) || null
      ]
    );

    res.json({ success: true, message: 'Thank you! Your review has been submitted and will appear after a quick moderation check (usually within 24 hours).' });
  } catch (err) {
    console.error('[reviews] Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/reviews/:company   – Get approved reviews for a company
══════════════════════════════════════════════════════════════ */
router.get('/:company', async (req, res) => {
  try {
    const company = decodeURIComponent(req.params.company).trim();
    const [reviews] = await db.query(
      `SELECT id, job_title, rating_overall, rating_salary, rating_iqama,
              rating_recommend, review_text, worked_from, worked_to,
              nationality, created_at
         FROM employer_reviews
        WHERE company_name LIKE ? AND approved = 1
        ORDER BY created_at DESC
        LIMIT 20`,
      [`%${company}%`]
    );

    const [[{ avg_rating }]] = await db.query(
      `SELECT ROUND(AVG(rating_overall), 1) AS avg_rating
         FROM employer_reviews WHERE company_name LIKE ? AND approved = 1`,
      [`%${company}%`]
    );

    res.json({ success: true, company, avg_rating, total: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/reviews   – Admin: list all reviews
══════════════════════════════════════════════════════════════ */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, approved } = req.query;
    const perPage = Math.min(parseInt(limit) || 50, 200);
    const offset  = (parseInt(page) - 1) * perPage;
    const whereApproved = approved !== undefined ? `WHERE approved = ${approved === '1' ? 1 : 0}` : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM employer_reviews ${whereApproved}`);
    const [reviews]     = await db.query(
      `SELECT * FROM employer_reviews ${whereApproved} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [perPage, offset]
    );
    res.json({ success: true, total, page: parseInt(page), reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   PUT /api/reviews/:id/approve   – Admin: approve review
══════════════════════════════════════════════════════════════ */
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE employer_reviews SET approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/reviews/:id   – Admin: delete review
══════════════════════════════════════════════════════════════ */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM employer_reviews WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
