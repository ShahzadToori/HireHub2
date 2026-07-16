/**
 * blacklist.js — Blacklisted Companies System
 * ─────────────────────────────────────────────────────────────
 * GET  /api/blacklist            Public: list approved blacklist entries
 * GET  /api/blacklist/search     Public: search by company name
 * POST /api/blacklist            Submit a blacklist report
 * DELETE /api/blacklist/:id      Admin: remove entry
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const db      = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');
const { publicFormLimiter } = require('../middleware/tieredRateLimit');

const router  = express.Router();

const digitsStr = (max) => z.string().regex(/^\d+$/).max(max).optional().or(z.literal(''));

const listQuerySchema = z.object({
  page:  digitsStr(6),
  limit: digitsStr(3),
}).strict();

const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional().or(z.literal('')),
}).strict();

const reportSchema = z.object({
  company_name:   z.string().trim().min(1).max(100),
  city:           z.string().trim().max(100).nullable().optional().or(z.literal('')),
  issue_type:     z.enum(['salary_delay', 'no_iqama', 'passport_held', 'fake_offer', 'poor_conditions', 'other']),
  description:    z.string().trim().min(20).max(1000),
  reported_year:  z.string().trim().regex(/^\d{4}$/, 'Must be a 4-digit year').nullable().optional().or(z.literal('')),
}).strict();

/* ═══════════════════════════════════════════════════════════════
   GET /api/blacklist  – List approved entries (paginated)
═══════════════════════════════════════════════════════════════ */
router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const perPage = Math.min(parseInt(limit) || 20, 100);
    const offset  = (parseInt(page) - 1) * perPage;

    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM company_blacklist WHERE approved = 1");
    const [entries]     = await db.query(
      `SELECT id, company_name, city, issue_type, description,
              reported_year, report_count, created_at
         FROM company_blacklist WHERE approved = 1
         ORDER BY report_count DESC, created_at DESC
         LIMIT ? OFFSET ?`,
      [perPage, offset]
    );

    res.json({ success: true, total, page: parseInt(page), entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/blacklist/search?q=CompanyName  – Search
═══════════════════════════════════════════════════════════════ */
router.get('/search', validate(searchQuerySchema, 'query'), async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ success: true, entries: [], found: false });

    const [entries] = await db.query(
      `SELECT id, company_name, city, issue_type, description,
              reported_year, report_count, created_at
         FROM company_blacklist
        WHERE approved = 1 AND company_name LIKE ?
        ORDER BY report_count DESC
        LIMIT 10`,
      [`%${q}%`]
    );

    res.json({ success: true, found: entries.length > 0, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/blacklist  – Submit a report
═══════════════════════════════════════════════════════════════ */
router.post('/', publicFormLimiter, validate(reportSchema), async (req, res) => {
  try {
    const { company_name, city, issue_type, description, reported_year } = req.body;

    // Check if company already reported — increment count instead of duplicate entry
    const [existing] = await db.query(
      'SELECT id FROM company_blacklist WHERE company_name LIKE ? AND issue_type = ? AND approved = 1 LIMIT 1',
      [`%${company_name.trim()}%`, issue_type]
    );

    if (existing.length > 0) {
      await db.query('UPDATE company_blacklist SET report_count = report_count + 1 WHERE id = ?', [existing[0].id]);
      return res.json({ success: true, message: 'Thank you. This report has been counted.' });
    }

    await db.query(
      `INSERT INTO company_blacklist
         (company_name, city, issue_type, description, reported_year, report_count, approved, created_at)
       VALUES (?,?,?,?,?,1,0,NOW())`,
      [
        company_name,
        city || null,
        issue_type,
        description,
        reported_year ? parseInt(reported_year) : null
      ]
    );

    res.json({ success: true, message: 'Report submitted. It will appear after review by our team.' });
  } catch (err) {
    console.error('[blacklist] Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PUT /api/blacklist/:id/approve   – Admin: approve
═══════════════════════════════════════════════════════════════ */
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE company_blacklist SET approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/blacklist/:id  – Admin: remove
═══════════════════════════════════════════════════════════════ */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM company_blacklist WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
