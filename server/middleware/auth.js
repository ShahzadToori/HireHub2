// Middleware: require admin session
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Unauthorized – please login' });
}

module.exports = { requireAdmin };
