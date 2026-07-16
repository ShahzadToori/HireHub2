'use strict';
const express          = require('express');
const db               = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const router           = express.Router();

function bustCache() {
  if (typeof global._invalidateRedirectCache === 'function') global._invalidateRedirectCache();
}

// GET /api/admin/redirects/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ total }]]  = await db.query('SELECT COUNT(*) AS total FROM redirects');
    const [[{ active }]] = await db.query('SELECT COUNT(*) AS active FROM redirects WHERE is_active=1');
    const [[{ hits }]]   = await db.query('SELECT COALESCE(SUM(hits),0) AS hits FROM redirects');
    res.json({ success:true, total, active, hits:Number(hits) });
  } catch(err) { console.error('[redirects stats]', err); res.status(500).json({ success:false }); }
});

// GET /api/admin/redirects
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page=1, limit=20, search='' } = req.query;
    const perPage = Math.min(parseInt(limit)||20, 500);
    const offset  = (Math.max(parseInt(page)||1,1)-1) * perPage;
    const where   = search ? 'WHERE from_path LIKE ? OR to_path LIKE ? OR note LIKE ?' : '';
    const params  = search ? [`%${search}%`,`%${search}%`,`%${search}%`] : [];
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM redirects ${where}`, params);
    const [rows]        = await db.query(
      `SELECT * FROM redirects ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );
    res.json({ success:true, total, page:parseInt(page)||1, redirects:rows });
  } catch(err) { console.error(err); res.status(500).json({ success:false, message:'Server error' }); }
});

// POST /api/admin/redirects
router.post('/', requireAdmin, async (req, res) => {
  try {
    let { from_path, to_path, redirect_type=301, note='', is_active=1 } = req.body;
    if (!from_path || !to_path)
      return res.status(400).json({ success:false, message:'from_path and to_path are required' });
    if (!from_path.startsWith('/') && !from_path.startsWith('http')) from_path = '/'+from_path;
    redirect_type = [301,302].includes(parseInt(redirect_type)) ? parseInt(redirect_type) : 301;
    if (from_path.trim() === to_path.trim())
      return res.status(400).json({ success:false, message:'From and To cannot be the same' });
    const [result] = await db.query(
      'INSERT INTO redirects (from_path,to_path,redirect_type,note,is_active) VALUES(?,?,?,?,?)',
      [from_path.trim(), to_path.trim(), redirect_type, (note||'').trim(), is_active?1:0]
    );
    bustCache();
    res.json({ success:true, id:result.insertId });
  } catch(err) {
    if (err.code==='ER_DUP_ENTRY')
      return res.status(400).json({ success:false, message:'A redirect from this path already exists' });
    console.error(err); res.status(500).json({ success:false, message:'Server error' });
  }
});

// PUT /api/admin/redirects/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    let { from_path, to_path, redirect_type=301, note='', is_active=1 } = req.body;
    if (!from_path || !to_path)
      return res.status(400).json({ success:false, message:'from_path and to_path are required' });
    if (!from_path.startsWith('/') && !from_path.startsWith('http')) from_path = '/'+from_path;
    redirect_type = [301,302].includes(parseInt(redirect_type)) ? parseInt(redirect_type) : 301;
    await db.query(
      'UPDATE redirects SET from_path=?,to_path=?,redirect_type=?,note=?,is_active=? WHERE id=?',
      [from_path.trim(), to_path.trim(), redirect_type, (note||'').trim(), is_active?1:0, req.params.id]
    );
    bustCache();
    res.json({ success:true });
  } catch(err) {
    if (err.code==='ER_DUP_ENTRY')
      return res.status(400).json({ success:false, message:'A redirect from this path already exists' });
    console.error(err); res.status(500).json({ success:false, message:'Server error' });
  }
});

// PATCH /api/admin/redirects/:id/toggle
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE redirects SET is_active=NOT is_active WHERE id=?', [req.params.id]);
    bustCache();
    res.json({ success:true });
  } catch(err) { console.error('[redirects toggle]', err); res.status(500).json({ success:false }); }
});

// POST /api/admin/redirects/bulk — CSV import
router.post('/bulk', requireAdmin, async (req, res) => {
  const { redirects } = req.body;
  if (!Array.isArray(redirects) || !redirects.length)
    return res.status(400).json({ success:false, message:'No redirects provided' });
  let imported=0, skipped=0;
  const errs=[];
  for (let r of redirects) {
    let { from_path, to_path, redirect_type=301, note='' } = r;
    if (!from_path || !to_path) { errs.push(`Missing from/to for row`); continue; }
    if (!from_path.startsWith('/') && !from_path.startsWith('http')) from_path='/'+from_path;
    redirect_type=[301,302].includes(parseInt(redirect_type))?parseInt(redirect_type):301;
    if (from_path.trim()===to_path.trim()) { errs.push(`${from_path}: same from/to`); continue; }
    try {
      await db.query(
        'INSERT INTO redirects (from_path,to_path,redirect_type,note,is_active) VALUES(?,?,?,?,1)',
        [from_path.trim(), to_path.trim(), redirect_type, (note||'').trim()]
      );
      imported++;
    } catch(e) {
      if (e.code==='ER_DUP_ENTRY') skipped++;
      else { console.error('[redirects bulk]', from_path, e); errs.push(`${from_path}: could not be saved`); }
    }
  }
  bustCache();
  res.json({ success:true, imported, skipped, errors:errs.slice(0,10) });
});

// DELETE /api/admin/redirects/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM redirects WHERE id=?', [req.params.id]);
    bustCache();
    res.json({ success:true });
  } catch(err) { console.error(err); res.status(500).json({ success:false, message:'Server error' }); }
});

module.exports = router;
