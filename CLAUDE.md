# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HireHub (branded "JobOrbit", live at joborbit.org) is a job-board web app: a public job board, an employer self-serve portal, and an admin panel, all served by one Express app backed by MySQL. A separate WhatsApp bot pipeline (`channel-forwarder/`) posts new jobs to WhatsApp channels/groups.

## Commands

```bash
npm install        # install server dependencies (run from repo root)
npm start           # run production server: node server/server.js
npm run dev         # run with nodemon auto-restart
```

There is no build step (plain server-rendered HTML/CSS/JS, no bundler) and no automated test suite or lint config in this repo — do not assume `npm test`/`npm run lint` do anything meaningful.

Database: MySQL 8+. `server/db/schema.sql` seeds only the original core tables (`admins`, `categories`, `jobs`, `settings`, `monetization`, `ad_placements`, `messages`) — the live schema has grown well beyond this file via ad-hoc `ALTER TABLE`s (e.g. `employers`, `employer_sessions`, `job_applications`, `redirects`, `admin_roles`, blog tables). **Treat `schema.sql` as a historical starting point, not the source of truth** — check the actual database or grep route files for the columns/tables they reference.

Channel-forwarder bot (separate Node project, own `package.json`):
```bash
cd channel-forwarder
npm install
node smart-cron.js   # posts active jobs to WhatsApp channel, pending jobs to a review group
node pair-link.js    # link WhatsApp via pairing code (no QR) instead of scanning
```
It loads env from a hardcoded VPS path (`/var/www/HireHub2/.env`) and expects `WHATSAPP_GROUP_ID`/`WHATSAPP_CHANNEL_ID` plus the same `DB_*` vars as the main server.

## Architecture

**Single Express app, three front-ends, one codebase:**
- `public/` — public job board (served at `/`), employer portal (`public/employer/`), misc calculator/checker tools (`public/tools/`), blog (`public/blog/`)
- `admin/` — admin panel, served statically at `/admin` with an SPA-style fallback (`app.get('/admin/*', ...)` returns `admin/index.html`)
- `server/` — Express app, routes, DB access

Everything is plain HTML/CSS/vanilla JS (no framework, no build step) — pages are static files that call the JSON API via `fetch`.

**Request pipeline (see `server/server.js` top to bottom — order matters):**
1. `helmet` (CSP disabled) + `cors({origin:false})` + rate limiter on `/api/*` (200 req/15min)
2. Body parsing, cookie-parser, MySQL-backed `express-session` (used by admin auth only)
3. `htmlLayout` middleware runs on every non-`/api` GET (see below)
4. A DB-driven redirect middleware (5-min in-memory cache, invalidated via `global._invalidateRedirectCache()`) checks the `redirects` table before falling through to routes
5. SEO routes (`sitemap.xml`, `feed.rss`, SSR `/job/:slug` for crawlers), blog routes, admin-users, dynamic `/robots.txt` (DB-backed with static-file fallback), then `express.static` for `public/` and `admin/`
6. `/api/*` routers mounted
7. Admin SPA fallback, `/requirement/:batchId` share pages, then a catch-all that serves `public/index.html` (client-side routing for anything unmatched)

**`server/middleware/htmlLayout.js`** is central to how pages are assembled — it is not just static file serving:
- Injects shared `public/partials/navbar.html`/`footer.html` into any HTML wherever `<!-- NAVBAR -->` / `<!-- FOOTER -->` comment markers appear, and hot-reloads those partials via `fs.watch` (edit once, every page updates, no restart)
- Rewrites `<title>`, meta description, OG/Twitter tags, and injects GA4 script per-page using DB settings (`settings` table, keys like `meta_home_title`, `meta_home_desc`, `og_image`, `ga4_id`), cached 5 minutes
- Any new static HTML page needs its meta keys added to `PAGE_META_KEYS` in this file to get per-page SEO metadata

**Two independent auth systems — do not confuse them:**
- Admin: `express-session` (MySQL-backed store) checked by `server/middleware/auth.js` (`requireAdmin`). Role/permission model lives in `admin_roles` (JSON `permissions` column), assigned per-admin and loaded into `req.session.permissions` at login (`server/routes/auth.js`).
- Employer: a bearer/cookie token (`emp_token` cookie or `x-employer-token` header) validated against the `employer_sessions` table by `server/middleware/employerAuth.js` (`requireEmployer`), with sliding expiry when "remember me" was set at login.

**Route responsibility split** (`server/routes/`): `jobs.js` (public job search/detail — full-text `MATCH...AGAINST`, `SQL_CALC_FOUND_ROWS` pagination), `admin.js` (admin job/category/upload CRUD, requires `requireAdmin` on the whole router), `admin-employers.js`/`admin-users.js` (admin management of employer accounts and admin sub-users), `employer.js` (employer self-serve: register/login/post jobs/applications — largest route file), `auth.js` (admin login), `settings.js` (site-wide key/value config used throughout), `seo.js` (sitemap/RSS/SSR — largest file, must stay registered before the SPA catch-all), `blog.js`/`blog-routes.js` (blog CMS + its own SEO routes), `redirects.js` (DB-backed redirect CRUD, must call `bustCache()` after writes so the server.js redirect cache picks up changes), `reviews.js`/`blacklist.js` (employer reviews & scam-reporting), `alerts.js` (email job-alert subscriptions + a 24h auto-digest scheduler started from `server.js`), `pdf.js` (Puppeteer-based PDF generation — conditionally loaded only when `PDF_ENABLED !== 'false'`, since Puppeteer isn't installed everywhere).

**Jobs can come from two sources**: legacy admin-created jobs (`employer_id IS NULL`) and employer-portal jobs (`employer_id` set). Nearly every public jobs query therefore joins `employers e` and filters `(j.employer_id IS NULL OR e.status = 'active')` so jobs from suspended/deleted employer accounts disappear without deleting the job rows — replicate this filter in any new public-facing job query.

**Dynamic job form**: `settings.form_schema_v2` (JSON) defines the public job-submission form fields, editable via `admin/form-builder.html`; submitted extra data is stored per-job as `jobs.extra_fields` (JSON).

**Uploads**: `multer` writes to `public/uploads/` (logos), with subfolders for blog images, CVs, and employer assets excluded from git (see `.gitignore`). A daily cleanup job in `server.js` deletes CVs (`job_applications.cv_url`) older than 30 days.

## Conventions to preserve

- All SQL uses `mysql2` parameterized queries (`?` placeholders) — never string-concatenate user input into SQL.
- Every route handler wraps its body in try/catch and responds `{ success: boolean, message?, ... }` — keep new endpoints consistent with this shape.
- `.backup`/`.bak` files (e.g. `server/server.js.backup`, `public/index.html.bak`) are manual snapshots left in the working tree, not build artifacts — leave them alone unless asked to clean them up.
- `.env` holds `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `NODE_ENV` (and, for the WhatsApp bot, `WHATSAPP_GROUP_ID`/`WHATSAPP_CHANNEL_ID`). It's gitignored — never print or commit its contents.


## Operational Rules (non-negotiable — decisions, not code)

- Workflow: local changes → git commit → push → VPS: `cd /var/www/HireHub2 && git pull origin main && pm2 restart all`. NEVER edit files directly on the VPS.
- All DB schema changes must be provided as commands for BOTH local AND VPS (`mysql -u jobuser -p hirehub`). This rule has been violated before and caused real damage.
- Windows local DB: MariaDB 12.3, full path `"C:\Program Files\MariaDB 12.3\bin\mysql.exe"`, user jobuser. Termux local: `mariadb -u jobuser -pHireHub2 hirehub`.
- WhatsApp pipeline: VPS crontab runs `run-smart.sh` every 5 minutes → `smart-cron.js`. Session lives in `cron-session/`. Relink with `node pair-link.js <phone-number>` (pairing code, single-phone friendly). Do NOT modify smart-cron.js or the crontab without explicit approval.
- `job-scraper` (server/jobs-scraper.js) is deliberately NOT running — output quality was poor. All jobs are manually uploaded. Do not re-enable.
- PM2 on VPS runs ONLY: HireHub2 (cluster ×2). The old `job-bot`/forwarder.js process was a zombie, deleted July 2026.
- Employer flow: register → status 'pending' → manual admin approval → email sent → can log in and post. Employers id=1 (Orbit) and id=2 (Orbit2) are test accounts.
- Correction to note above: `.bak`/`.backup` files are junk slated for cleanup (gitignored since July 2026), not snapshots to preserve.
- Never restart, stop, or delete PM2 processes without explicit user approval.