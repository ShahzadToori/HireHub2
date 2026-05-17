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

const router  = express.Router();

/* ═══════════════════════════════════════════════════════════════
   GET /api/blacklist  – List approved entries (paginated)
═══════════════════════════════════════════════════════════════ */
router.get('/', async (req, res) => {
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
router.get('/search', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { company_name, city, issue_type, description, reported_year } = req.body;

    if (!company_name?.trim()) return res.status(400).json({ success: false, message: 'Company name is required.' });
    if (!issue_type)           return res.status(400).json({ success: false, message: 'Issue type is required.' });
    if (!description?.trim() || description.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description must be at least 20 characters.' });
    }

    const validIssues = ['salary_delay', 'no_iqama', 'passport_held', 'fake_offer', 'poor_conditions', 'other'];
    if (!validIssues.includes(issue_type)) return res.status(400).json({ success: false, message: 'Invalid issue type.' });

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
        company_name.trim().substring(0, 100),
        city?.trim()?.substring(0, 100) || null,
        issue_type,
        description.trim().substring(0, 1000),
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
