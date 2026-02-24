# HireHub – Job Board Implementation Guide

## Project Structure

```
job-board/
├── server/
│   ├── server.js                 # Express app entry point
│   ├── db/
│   │   ├── connection.js         # MySQL2 connection pool
│   │   └── schema.sql            # Database schema + seed data
│   ├── middleware/
│   │   └── auth.js               # Admin session guard
│   └── routes/
│       ├── auth.js               # Login / logout / setup
│       ├── jobs.js               # Public jobs API
│       ├── admin.js              # Admin CRUD + uploads
│       └── settings.js           # Site settings API
├── public/                       # Public job board (served at /)
│   ├── index.html
│   ├── css/style.css
│   ├── js/main.js
│   └── uploads/                  # Logo uploads go here
├── admin/                        # Admin panel (served at /admin)
│   ├── index.html                # Login page
│   ├── dashboard.html
│   ├── jobs.html                 # Manage all jobs
│   ├── add-job.html              # Add & edit jobs (shared)
│   ├── edit-job.html             # Redirect → add-job.html?id=X
│   ├── categories.html
│   ├── monetization.html
│   ├── settings.html
│   ├── css/admin.css
│   └── js/admin.js               # Shared admin utilities
├── package.json
└── .env.example
```

---

## Step 1 – Prerequisites

```bash
# Node.js 18+ and MySQL 8+ required
node --version   # should be ≥ 18
mysql --version  # should be ≥ 8
```

---

## Step 2 – Database Setup

```bash
# Log into MySQL
mysql -u root -p

# Run the schema
SOURCE /path/to/job-board/server/db/schema.sql;
```

This creates:
- `admins` table (bcrypt-hashed passwords)
- `categories` table (10 defaults inserted)
- `jobs` table (full-text indexed for search)
- `settings` table (key-value, pre-populated)
- `monetization` table (4 features)
- `ad_placements` table (4 zones)

---

## Step 3 – Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=jobboard
SESSION_SECRET=generate_a_long_random_string_here
PORT=3000
NODE_ENV=production
```

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 4 – Install & Run

```bash
cd job-board
npm install
npm start          # production
# or
npm run dev        # development with auto-restart (nodemon)
```

Server starts at **http://localhost:3000**

---

## Step 5 – Create First Admin

Open your browser or use curl:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"yourpassword123"}'
```

Or use the "First time? Create admin account" link on the login page.

> ⚠️ This endpoint is disabled once any admin exists.

---

## Step 6 – Access Points

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Public job board |
| `http://localhost:3000/admin` | Admin login |
| `http://localhost:3000/admin/dashboard.html` | Admin dashboard |

---

## API Reference

### Public Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/jobs` | List jobs (search/filter/paginate) |
| GET | `/api/jobs/featured` | Featured & sponsored jobs |
| GET | `/api/jobs/categories` | Categories with job counts |
| GET | `/api/jobs/:slug` | Single job detail |
| GET | `/api/settings` | Site settings (public) |

**Jobs query params:**
```
?q=developer          # keyword full-text search
&category=technology  # category slug
&location=New York    # location (partial match)
&type=Full-time       # job type
&sort=newest          # newest | oldest | title
&page=1               # pagination
&limit=12             # per page (max 50)
&featured=1           # featured only
```

### Admin Endpoints (require session)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Check session |
| POST | `/api/auth/setup` | Create first admin |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/jobs` | List all jobs (admin) |
| POST | `/api/admin/jobs` | Create job |
| PUT | `/api/admin/jobs/:id` | Update job |
| DELETE | `/api/admin/jobs/:id` | Delete single job |
| DELETE | `/api/admin/jobs` | Bulk delete `{ids:[]}` |
| POST | `/api/admin/upload-logo` | Upload logo (multipart) |
| GET/POST/DELETE | `/api/admin/categories` | Category CRUD |
| GET | `/api/admin/monetization` | Get features + ads |
| PUT | `/api/admin/monetization/:id` | Update feature |
| PUT | `/api/admin/ad-placements/:id` | Update ad zone |
| PUT | `/api/settings` | Update site settings |

---

## Key Code Patterns

### Adding a Job (Admin form)

```javascript
const body = {
  title:         "Senior Developer",
  company:       "Tech Corp",
  category_id:   1,
  location:      "Remote",
  job_type:      "Full-time",
  description:   "We are looking for...",
  phone:         "+1234567890",
  whatsapp:      "1234567890",   // country code, digits only
  email:         "jobs@corp.com",
  status:        "active",
  featured:      1,              // 1 = featured
  sponsored:     0,
  featured_until: "2025-12-31"
};

const res  = await fetch('/api/admin/jobs', {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify(body)
});
const data = await res.json();  // { success: true, slug: "senior-developer" }
```

### WhatsApp Link Generation

```javascript
function waLink(number, jobTitle) {
  // Strip all non-digits
  const clean = number.replace(/\D/g, '');
  const msg   = encodeURIComponent(`Hi, I'm interested in the "${jobTitle}" position.`);
  return `https://wa.me/${clean}?text=${msg}`;
}

// Usage
<a href="${waLink('15550001234', 'Senior Developer')}" target="_blank">
  WhatsApp
</a>
```

### Dark Mode Toggle

```javascript
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // CSS variables automatically switch via [data-theme="dark"] selector
}

// On page load
const saved = localStorage.getItem('theme') || 'light';
applyTheme(saved);

// Toggle button
btn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
```

### Dynamic Job Filtering (no page reload)

```javascript
// All filters update state then call loadJobs()
const state = { q: '', category: '', location: '', type: '', sort: 'newest', page: 1 };

async function loadJobs() {
  const params = new URLSearchParams(state);
  const data   = await fetch(`/api/jobs?${params}`).then(r => r.json());
  renderJobs(data.jobs);
  buildPagination(data.page, data.pages);
}

// Debounced keyword search
let timer;
searchInput.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.q    = searchInput.value.trim();
    state.page = 1;
    loadJobs();
  }, 350);
});
```

---

## Monetization Setup

1. Go to **Admin → Monetization**
2. Set pricing for each feature (Featured Job, Sponsored, Banner Ads)
3. Enable/disable each feature
4. Paste Google AdSense code into ad zone textareas

### Ad Zones
| Zone | Location |
|------|----------|
| `top` | Top of every page |
| `sidebar` | Job listings sidebar |
| `between_jobs` | Between job cards (after position 6) |
| `footer` | Page footer |

---

## SEO Checklist

✅ Proper `<title>`, `<meta description>`, `<meta keywords>` tags  
✅ `<link rel="canonical">` tags  
✅ Open Graph meta tags  
✅ JSON-LD `JobPosting` schema markup (dynamically updated)  
✅ `<meta name="robots" content="noindex">` on admin pages  
✅ Semantic HTML structure  
✅ Slug-based URLs for jobs  
✅ Full-text MySQL search for keyword relevance  

---

## Security Features

- **bcrypt** password hashing (cost factor 12)
- **express-session** with `httpOnly` + `secure` cookies
- **helmet** HTTP security headers
- **express-rate-limit** (200 req / 15 min on all `/api/*`)
- **SQL injection protection** via parameterized queries (`?` placeholders)
- **XSS protection** via HTML escaping in all rendered content
- **File upload validation** (type + size limits)
- Admin routes protected by session middleware

---

## Performance Tips

1. **MySQL indexes** on `status`, `featured`, `category_id`, `created_at`, and full-text on `title/company/description`
2. **Pagination** – max 50 jobs per request
3. **Connection pooling** – `mysql2` pool with 10 connections
4. **Lazy loading** – Jobs load after page renders
5. **Debounced search** – 350ms delay prevents excessive API calls
6. **Bootstrap CDN** – cached by browser across sessions

---

## Production Deployment

```bash
# Install PM2 process manager
npm install -g pm2

# Start with PM2
pm2 start server/server.js --name hirehub

# Auto-restart on reboot
pm2 startup
pm2 save

# With Nginx reverse proxy:
# proxy_pass http://localhost:3000;
```

### Nginx Config (recommended)

```nginx
server {
  server_name yourdomain.com;
  
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
  }
  
  # Cache static assets
  location ~* \.(css|js|png|jpg|svg|ico)$ {
    proxy_pass http://localhost:3000;
    expires 30d;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## Database Table Relationships

```
admins (1) ──────────── manages everything

categories (1) ──────── (many) jobs.category_id

jobs (1) ──────────────── independent
  featured_until: DATE   tracks feature expiry

settings (key-value) ─── site-wide config
monetization ──────────── paid feature config
ad_placements ─────────── ad zone HTML
```

---

## Customization via Admin Panel

| Setting | What it changes |
|---------|----------------|
| Site Name | Navbar brand + page title + footer |
| Hero Title/Subtitle | Homepage hero section text |
| Primary Color | All buttons, links, accents (CSS variable) |
| Secondary Color | Navbar/footer background |
| Default Theme | Light or dark mode default |
| Logo | Upload PNG/SVG (max 2MB) |
| Jobs Per Page | Pagination size |
| Section toggles | Show/hide featured, sponsored, ads |
