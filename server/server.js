require('dotenv').config();
const express       = require('express');
const session       = require('express-session');
const helmet        = require('helmet');
const cors          = require('cors');
const path          = require('path');
const rateLimit     = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const jobsRoutes     = require('./routes/jobs');
const adminRoutes    = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const contactRoutes  = require('./routes/contact');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({ origin: false }));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false
});
app.use('/api/', limiter);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Sessions ──────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'super-secret-key',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000
  }
}));

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

const db = require('./db/connection');

// Serve job detail page
app.get('/job/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/job.html'));
});

// ── Public form schema (no auth – used by public modal) ────────
app.get('/api/public/form-schema', async (req, res) => {
  try {
    const [[row]] = await db.execute(
      "SELECT `value` FROM settings WHERE `key` = 'form_schema_v2' LIMIT 1"
    );
    const schema = row ? JSON.parse(row.value) : { sections: [] };
    res.json({ success: true, schema });
  } catch {
    res.json({ success: true, schema: { sections: [] } });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/jobs',     jobsRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contact',  contactRoutes);

// ── SPA Fallback ──────────────────────────────────────────────
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀  Job Board running → http://localhost:${PORT}`);
  console.log(`🔧  Admin panel     → http://localhost:${PORT}/admin`);
});
