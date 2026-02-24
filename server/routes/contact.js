const express = require('express');
const db      = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const router  = express.Router();

// POST /api/contact  – public
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject and message are required.' });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (name.length > 120 || email.length > 160 || subject.length > 255 || message.length > 5000) {
      return res.status(400).json({ success: false, message: 'Input too long.' });
    }
    await db.query(
      'INSERT INTO messages (name, email, phone, company, subject, message) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, company ? company.trim() : null, subject.trim(), message.trim()]
    );
    res.json({ success: true, message: 'Message sent successfully! We will get back to you soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// GET /api/contact  – admin list
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(parseInt(limit) || 20, 100);
    const offset  = (parseInt(page) - 1) * perPage;
    let where = [], params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM messages ${whereSql}`, params);
    const [messages]    = await db.query(
      `SELECT id, name, email, phone, company, subject, status, created_at FROM messages ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );
    const [[{ unread }]] = await db.query("SELECT COUNT(*) AS unread FROM messages WHERE status = 'unread'");
    res.json({ success: true, total, unread, page: parseInt(page), perPage, pages: Math.ceil(total / perPage), messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/contact/:id  – admin single
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM messages WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    if (rows[0].status === 'unread') {
      await db.query("UPDATE messages SET status = 'read' WHERE id = ?", [req.params.id]);
      rows[0].status = 'read';
    }
    res.json({ success: true, message: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/contact/:id/status
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['read', 'unread', 'replied'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await db.query('UPDATE messages SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/contact/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
