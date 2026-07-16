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
const { validate, z } = require('../middleware/validate');

const router  = express.Router();

const currentYear = new Date().getFullYear();
const rating = () => z.union([z.number().int().min(1).max(5), z.literal(null)]).optional();

const reviewSchema = z.object({
  company_name:     z.string().trim().min(1).max(100),
  job_title:        z.string().trim().max(100).nullable().optional().or(z.literal('')),
  rating_overall:   z.number().int().min(1).max(5),
  rating_salary:    rating(),
  rating_iqama:     rating(),
  rating_recommend: rating(),
  review_text:      z.string().trim().min(30).max(2000),
  worked_from:      z.string().trim().regex(/^\d{4}$/, 'Must be a 4-digit year').nullable().optional().or(z.literal('')),
  worked_to:        z.string().trim().max(10).regex(/^(\d{4}|present)$/i, 'Must be a year or "present"').nullable().optional().or(z.literal('')),
  nationality:      z.string().trim().max(50).nullable().optional().or(z.literal('')),
}).strict();

/* ── Simple rate limit (in-memory) ───────────────────────────── */
const reviewAttempts = new Map();
function reviewRateLimit(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const win = parseInt(process.env.RATE_LIMIT_REVIEWS_WINDOW_MS) || 60 * 60 * 1000; // 1 hour
  const max = parseInt(process.env.RATE_LIMIT_REVIEWS_MAX)       || 3;              // reviews per IP per window
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
router.post('/', reviewRateLimit, validate(reviewSchema), async (req, res) => {
  try {
    const {
      company_name,
      job_title,
      rating_overall,
      rating_salary,
      rating_iqama,
      rating_recommend,
      review_text,
      worked_from,
      worked_to,
      nationality
    } = req.body;

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
        company_name,
        job_title || null,
        rating_overall,
        rating_salary  ?? null,
        rating_iqama   ?? null,
        rating_recommend ?? null,
        review_text,
        worked_from ? parseInt(worked_from) : null,
        worked_to || null,
        nationality || null
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
