const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/connection');
const router  = express.Router();

// Middleware - super admin only
function requireSuperAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (req.session.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super admin only' });
  next();
}

// GET /api/admin-users — list all sub-admins
router.get('/api/admin-users', requireSuperAdmin, async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, username, email, full_name, role, status, created_at FROM admins ORDER BY created_at DESC'
  );
  res.json({ success: true, users: rows });
});

// POST /api/admin-users — create sub-admin
router.post('/api/admin-users', requireSuperAdmin, async (req, res) => {
  const { username, email, password, full_name, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ success: false, message: 'Username, password and role required' });
  try {
    const [existing] = await db.query('SELECT id FROM admins WHERE username = ? OR email = ? LIMIT 1', [username, email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Username or email already exists' });
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO admins (username, email, password, full_name, role, status) VALUES (?,?,?,?,?,?)',
      [username, email || '', hash, full_name || '', role, 'active']
    );
    res.json({ success: true, message: 'Admin account created' });
  } catch(e) {
    console.error('[admin-users POST]', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin-users/:id — update sub-admin
router.put('/api/admin-users/:id', requireSuperAdmin, async (req, res) => {
  const { role, status, full_name, password } = req.body;
  const id = req.params.id;
  // Prevent modifying own account role
  if (parseInt(id) === req.session.adminId && role !== 'super_admin') {
    return res.status(400).json({ success: false, message: 'Cannot change your own role' });
  }
  try {
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 12);
      await db.query('UPDATE admins SET role=?, status=?, full_name=?, password=? WHERE id=?', [role, status, full_name||'', hash, id]);
    } else {
      await db.query('UPDATE admins SET role=?, status=?, full_name=? WHERE id=?', [role, status, full_name||'', id]);
    }
    res.json({ success: true, message: 'Account updated' });
  } catch(e) {
    console.error('[admin-users PUT]', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/admin-users/:id — delete sub-admin
router.delete('/api/admin-users/:id', requireSuperAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.session.adminId) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }
  await db.query('DELETE FROM admins WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Account deleted' });
});

// GET /api/admin-roles — list all roles
router.get('/api/admin-roles', requireSuperAdmin, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM admin_roles ORDER BY name');
  res.json({ success: true, roles: rows });
});

// POST /api/admin-roles — create custom role
router.post('/api/admin-roles', requireSuperAdmin, async (req, res) => {
  const { name, label, permissions } = req.body;
  if (!name || !label || !permissions) return res.status(400).json({ success: false, message: 'All fields required' });
  try {
    await db.query('INSERT INTO admin_roles (name, label, permissions) VALUES (?,?,?)',
      [name.toLowerCase().replace(/\s+/g,'-'), label, JSON.stringify(permissions)]
    );
    res.json({ success: true, message: 'Role created' });
  } catch(e) {
    console.error('[admin-roles POST]', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin-roles/:id — update role permissions
router.put('/api/admin-roles/:id', requireSuperAdmin, async (req, res) => {
  const { label, permissions } = req.body;
  await db.query('UPDATE admin_roles SET label=?, permissions=? WHERE id=?',
    [label, JSON.stringify(permissions), req.params.id]
  );
  res.json({ success: true, message: 'Role updated' });
});

// DELETE /api/admin-roles/:id — delete role
router.delete('/api/admin-roles/:id', requireSuperAdmin, async (req, res) => {
  const [role] = await db.query('SELECT name FROM admin_roles WHERE id=?', [req.params.id]);
  if (role[0]?.name === 'super_admin') return res.status(400).json({ success: false, message: 'Cannot delete super admin role' });
  await db.query('DELETE FROM admin_roles WHERE id=?', [req.params.id]);
  res.json({ success: true, message: 'Role deleted' });
});

module.exports = router;

/* ── Menu Management API ─────────────────────────────────── */

// GET /api/admin-menu — returns menu for current user based on permissions
router.get('/api/admin-menu', async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ success: false });
  try {
    const [items] = await db.query(
      'SELECT * FROM admin_menu WHERE is_active = 1 ORDER BY order_num ASC'
    );
    const perms = req.session.permissions || [];
    const role  = req.session.role || '';
    // Super admin sees everything active
    const filtered = role === 'super_admin' ? items : items.filter(i => perms.includes(i.key_name));
    res.json({ success: true, menu: filtered });
  } catch(e) { console.error('[admin-menu]', e); res.status(500).json({ success: false, error: 'Server error' }); }
});

// GET /api/admin-menu/all — all items including inactive (super admin only)
router.get('/api/admin-menu/all', requireSuperAdmin, async (req, res) => {
  const [items] = await db.query('SELECT * FROM admin_menu ORDER BY order_num ASC');
  res.json({ success: true, menu: items });
});

// PUT /api/admin-menu/:id — update menu item
router.put('/api/admin-menu/:id', requireSuperAdmin, async (req, res) => {
  const { label, icon, href, order_num, is_active } = req.body;
  await db.query(
    'UPDATE admin_menu SET label=?, icon=?, href=?, order_num=?, is_active=? WHERE id=?',
    [label, icon, href, order_num, is_active ? 1 : 0, req.params.id]
  );
  res.json({ success: true, message: 'Menu item updated' });
});

// POST /api/admin-menu/reorder — bulk reorder
router.post('/api/admin-menu/reorder', requireSuperAdmin, async (req, res) => {
  const { order } = req.body; // array of { id, order_num }
  for (const item of order) {
    await db.query('UPDATE admin_menu SET order_num=? WHERE id=?', [item.order_num, item.id]);
  }
  res.json({ success: true, message: 'Menu reordered' });
});
