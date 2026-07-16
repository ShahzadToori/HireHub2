require('dotenv').config();
const express       = require('express');
const session      = require('express-session');
const MySQLStore   = require('express-mysql-session')(session);
const helmet        = require('helmet');
const cors          = require('cors');
const path          = require('path');

const authRoutes     = require('./routes/auth');
const jobsRoutes     = require('./routes/jobs');
const adminRoutes    = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const contactRoutes  = require('./routes/contact');
const seoRoutes      = require('./routes/seo');
const { router: alertsRouter, scheduleAutoDigest } = require('./routes/alerts');
const reviewsRouter  = require('./routes/reviews');
const blacklistRouter = require('./routes/blacklist');
const employerRouter  = require('./routes/employer');
const htmlLayout = require('./middleware/htmlLayout');
const blogRoutes    = require('./routes/blog');
const blogSeoRoutes = require('./routes/blog-routes');
const adminUsersRoutes = require('./routes/admin-users');
const redirectsRoutes       = require('./routes/redirects');
const adminEmployersRoutes  = require('./routes/admin-employers');


// Fail fast rather than silently signing sessions with a well-known fallback
// secret that's visible to anyone reading the source.
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET is not set in .env — refusing to start with an insecure default.');
  process.exit(1);
}

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: false }));

// ── Rate limiting ─────────────────────────────────────────────
// Baseline safety-net tier for all /api/* — thresholds configurable via
// RATE_LIMIT_GLOBAL_WINDOW_MS / RATE_LIMIT_GLOBAL_MAX env vars. Individual
// route groups (see tieredRateLimit.js, authRateLimit.js) layer stricter
// or looser limits on top of this for their specific risk level.
const { globalLimiter } = require('./middleware/tieredRateLimit');
app.use('/api/', globalLimiter);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(require('cookie-parser')());
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Sessions ──────────────────────────────────────────────────
const sessionStore = new MySQLStore({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'hirehub_db',
  clearExpired:       true,
  checkExpirationInterval: 900000,
  expiration:         28800000,
  createDatabaseTable: true,
});

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store:             sessionStore,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000
  }
}));

// Old "Post a Job" contact-form flow is replaced by the employer self-serve portal
// MUST be registered before the htmlLayout static-file middleware below —
// public/contact.html still exists on disk, so htmlLayout would otherwise
// serve that stale file directly and this redirect would never run.
app.get('/contact.html', (req, res) => res.redirect(301, '/employer/'));

// ── Static files ──────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return htmlLayout(req, res, next);
});
app.get('/manifest.json', (req, res) => res.status(404).json({}));

// ── Redirect middleware (cached, 5 min TTL) ───────────────────
{
  let _rdxCache = null, _rdxCacheAt = 0;
  const _rdxTTL = 300000;
  const _rdxDb  = require('./db/connection');
  global._invalidateRedirectCache = () => { _rdxCacheAt = 0; };
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/admin')) return next();
    try {
      if (!_rdxCache || Date.now() - _rdxCacheAt > _rdxTTL) {
        const [rows] = await _rdxDb.query('SELECT id,from_path,to_path,redirect_type FROM redirects WHERE is_active=1');
        _rdxCache = rows; _rdxCacheAt = Date.now();
      }
      const _rp = req.path.replace(/\/+$/, '') || '/';
      const match = _rdxCache.find(r => {
        const _fp = r.from_path.replace(/\/+$/, '') || '/';
        return _fp.toLowerCase() === _rp.toLowerCase();
      });
      if (match) {
        _rdxDb.query('UPDATE redirects SET hits=hits+1 WHERE id=?', [match.id]).catch(() => {});
        return res.redirect(match.redirect_type, match.to_path);
      }
    } catch(e) { /* never block on redirect error */ }
    next();
  });
}
app.use("/", seoRoutes);
app.use(blogSeoRoutes);
app.use(blogRoutes);
app.use(adminUsersRoutes);
// Robots.txt served dynamically from DB — editable from admin Settings page
app.get('/robots.txt', async (req, res, next) => {
  try {
    const dbConn = require('./db/connection');
    const [[row]] = await dbConn.query("SELECT `value` FROM settings WHERE `key` = 'robots_txt'");
    if (row && row.value) return res.type('text/plain').send(row.value);
    next(); // fall through to static file until DB is seeded
  } catch { next(); }
});
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

const db = require('./db/connection');

// ── SEO Routes (sitemap, RSS, SSR job pages) ──────────────────
// MUST be registered BEFORE the /job/* catch-all below

// ── Public form schema (no auth – used by public modal) ────────
app.get('/api/public/form-schema', async (req, res) => {
  try {
    const [[row]] = await db.query(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = row ? JSON.parse(row.value) : { sections: [] };
    res.json({ success: true, schema });
  } catch {
    res.json({ success: true, schema: { sections: [] } });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/jobs',      jobsRoutes);
app.use('/api/admin/redirects',  redirectsRoutes);
app.use('/api/admin/employers',  adminEmployersRoutes);
app.use('/api/admin',            adminRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/contact',   contactRoutes);
app.use('/api/alerts',    alertsRouter);
app.use('/api/reviews',   reviewsRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/employer',  employerRouter);
// Only load PDF on VPS where Puppeteer is installed
if (process.env.PDF_ENABLED !== 'false') {
  const pdfRoute = require('./routes/pdf');
  app.use(pdfRoute);
}

// ── SPA Fallback ──────────────────────────────────────────────
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Requirement share pages
app.get('/requirement/:batchId', (req, res) => {
  try {
    const html = require('fs').readFileSync(
      require('path').join(__dirname, '../public/requirement.html'), 'utf8'
    );
    res.send(htmlLayout.inject(html));
  } catch(e) { res.status(500).send('Page not found'); }
});

// NOTE: /job/* is handled by seoRoutes (SSR for bots).
// If seoRoutes calls next() (job not found), it falls through here → 404
//app.get('*', (req, res) => {
  //res.sendFile(path.join(__dirname, '../public/index.html'));
//});

app.get('*', (req, res) => {
  const html = require('fs').readFileSync(
    require('path').join(__dirname, '../public/index.html'), 'utf8'
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlLayout.inject(html));
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Full details go to the server log only — never to the client.
  console.error(err.stack || err);
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: status < 500 && err.expose ? err.message : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀  Job Board running → http://localhost:${PORT}`);
  console.log(`🔧  Admin panel     → http://localhost:${PORT}/admin`);
  console.log(`🗺   Sitemap         → http://localhost:${PORT}/sitemap.xml`);
  console.log(`📡  RSS Feed         → http://localhost:${PORT}/feed.rss`);

  // Start email alert auto-digest (runs every 24h)
  scheduleAutoDigest();

  // Daily CV cleanup — delete CVs older than 30 days
  const _cvClean = async () => {
    try {
      const db = require('./db/connection');
      const fs = require('fs');
      const path = require('path');
      const [expired] = await db.query(
        'SELECT id, cv_url FROM job_applications WHERE cv_url IS NOT NULL AND cv_uploaded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
      );
      // cv_url is a bare filename (current uploads) or, for rows predating the
      // uploads-private migration, a legacy '/uploads/cvs/<filename>' path —
      // check both locations so old and new CVs both get cleaned up.
      for (const a of expired) {
        try {
          const filename = path.basename(a.cv_url);
          const privateFp = path.join(__dirname, '../uploads-private/cvs', filename);
          const legacyFp  = path.join(__dirname, '../public/uploads/cvs', filename);
          if (fs.existsSync(privateFp)) fs.unlinkSync(privateFp);
          else if (fs.existsSync(legacyFp)) fs.unlinkSync(legacyFp);
        } catch(e) {}
      }
      if (expired.length) {
        await db.query('UPDATE job_applications SET cv_url=NULL, cv_uploaded_at=NULL WHERE cv_url IS NOT NULL AND cv_uploaded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
        console.log('[CV cleanup] Deleted', expired.length, 'expired CVs');
      }
    } catch(e) { console.error('[CV cleanup]', e.message); }
  };
  _cvClean(); // run on startup to catch any missed
  setInterval(_cvClean, 24 * 60 * 60 * 1000);
});
