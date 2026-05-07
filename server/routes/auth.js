const express = require('express');
const bcrypt  = require('bcrypt');
const db      = require('../db/connection');
const router  = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const [rows] = await db.query(
      'SELECT * FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const admin   = rows[0];
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.adminId  = admin.id;
    req.session.username = admin.username;

    res.json({ success: true, message: 'Login successful', username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session.adminId) {
    return res.json({ success: true, loggedIn: true, username: req.session.username });
  }
  res.json({ success: true, loggedIn: false });
});

// POST /api/auth/setup  (run once to create first admin)
router.post('/setup', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM admins LIMIT 1');
    if (existing.length > 0) {
      return res.status(403).json({ success: false, message: 'Admin already exists' });
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO admins (username, email, password) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    res.json({ success: true, message: 'Admin account created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
