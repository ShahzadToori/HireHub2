const express = require('express');
const db      = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const router  = express.Router();

// GET /api/settings  – public (website needs these)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT `key`, `value` FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/settings  – admin only
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    const entries = Object.entries(updates);

    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided' });
    }

    for (const [key, value] of entries) {
      // Only update known keys to prevent injection
      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?',
        [key, value, value]
      );
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
