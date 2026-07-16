const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/connection');
const { validate, z } = require('../middleware/validate');
const { authRateLimit, recordAuthFailure, recordAuthSuccess } = require('../middleware/authRateLimit');
const router  = express.Router();

const adminLoginLimiter = authRateLimit('admin-login', (req) => req.body.username);

const loginSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(72)
}).strict();

const setupSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens'),
  email: z.string().trim().max(160).email(),
  password: z.string().min(8).max(72)
}).strict();

// POST /api/auth/login
router.post('/login', adminLoginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username, username]
    );

    if (rows.length === 0) {
      await recordAuthFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const admin   = rows[0];
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      await recordAuthFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check account status BEFORE establishing any session — a disabled
    // admin must never receive a valid session cookie, even momentarily.
    if (admin.status === 'inactive') {
      await recordAuthFailure(req);
      return res.status(403).json({ success: false, message: 'Account is disabled' });
    }

    req.session.adminId  = admin.id;
    req.session.username = admin.username;
    req.session.role     = admin.role || 'super_admin';
    req.session.status   = admin.status || 'active';

    // Fetch permissions for this role
    const [roleRows] = await db.query(
      'SELECT permissions FROM admin_roles WHERE name = ? LIMIT 1',
      [admin.role || 'super_admin']
    );
    const permissions = roleRows.length ? (typeof roleRows[0].permissions === "string" ? JSON.parse(roleRows[0].permissions) : roleRows[0].permissions) : [];
    req.session.permissions = permissions;

    await recordAuthSuccess(req);
    res.json({ success: true, message: 'Login successful', username: admin.username, role: admin.role, permissions });
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
router.get('/me', async (req, res) => {
  if (req.session.adminId) {
    // Refresh permissions from DB in case role changed
    const [roleRows] = await db.query(
      'SELECT permissions FROM admin_roles WHERE name = ? LIMIT 1',
      [req.session.role || 'super_admin']
    ).catch(() => [[]]);
    const permissions = roleRows.length ? (typeof roleRows[0].permissions === "string" ? JSON.parse(roleRows[0].permissions) : roleRows[0].permissions) : (req.session.permissions || []);
    return res.json({ success: true, loggedIn: true, username: req.session.username, role: req.session.role || 'super_admin', permissions });
  }
  res.json({ success: true, loggedIn: false });
});

// POST /api/auth/setup  (run once to create first admin)
router.post('/setup', validate(setupSchema), async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM admins LIMIT 1');
    if (existing.length > 0) {
      return res.status(403).json({ success: false, message: 'Admin already exists' });
    }

    const { username, email, password } = req.body;
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
