/* ══════════════════════════════════════════════════════════
   jobs-scraper.js — Auto-fetch Saudi jobs
   Sources: JSearch API + Adzuna API
   Runs every 6 hours via PM2 cron
══════════════════════════════════════════════════════════ */
require('dotenv').config();
const db = require('./db/connection');

const JSEARCH_KEY  = process.env.JSEARCH_API_KEY;
const ADZUNA_ID    = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY   = process.env.ADZUNA_APP_KEY;

// ── Dynamic category matching from DB ────────────────────
async function getCategoryId(title) {
  const [cats] = await db.query('SELECT id, name, slug FROM categories');
  const t = (title || '').toLowerCase();
  let bestId = cats[0]?.id || 1, bestScore = 0;
  for (const cat of cats) {
    const keywords = cat.slug.replace(/-/g,' ').split(' ')
      .concat(cat.name.toLowerCase().split(/[\s\/]+/));
    let score = 0;
    for (const kw of keywords) { if (kw.length > 2 && t.includes(kw)) score++; }
    if (score > bestScore) { bestScore = score; bestId = cat.id; }
  }
  if (bestScore === 0) {
    const other = cats.find(c => c.slug.includes('other') || c.slug.includes('specialist'));
    if (other) bestId = other.id;
  }
  return bestId;
}

// ── Generate slug ─────────────────────────────────────────
function makeSlug(title, company) {
  return (title + '-' + company)
    .toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-')
    .slice(0, 80) + '-' + Date.now().toString(36);
}

// ── Save job (shared for both APIs) ──────────────────────
async function saveJob(title, company, location, description, applyLink, jobType, salary) {
  if (!title || !company) return false;
  title   = title.slice(0, 200);
  company = company.slice(0, 200);
  const [existing] = await db.query(
    'SELECT id FROM jobs WHERE title=? AND company=? LIMIT 1', [title, company]
  );
  if (existing.length) return false;
  const catId = await getCategoryId(title);
  const slug  = makeSlug(title, company);
  await db.query(
    `INSERT INTO jobs (title,company,category_id,location,job_type,description,
      apply_link,salary,status,slug,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,'active',?,NOW(),NOW())`,
    [title, company, catId, (location||'Saudi Arabia').slice(0,200),
     jobType||'full-time', description||'', applyLink||'', salary||'', slug]
  );
  return true;
}

/* ════════════════════════════════════════════════════════
   SOURCE 1 — JSearch API
════════════════════════════════════════════════════════ */
const JSEARCH_QUERIES = [
  'safety officer HSE QC inspector jobs Saudi Arabia',
  'WPR permit receiver construction jobs Saudi Arabia',
  'welder fabricator rigger scaffolding Saudi Arabia',
  'civil mechanical engineer construction Saudi Arabia',
  'site supervisor foreman construction Saudi Arabia',
  'NDT electrical instrumentation technician Saudi Arabia',
];

async function runJSearch() {
  if (!JSEARCH_KEY) { console.log('[JSearch] No API key — skipping'); return 0; }
  let saved = 0;
  for (const query of JSEARCH_QUERIES) {
    try {
      const url = new URL('https://jsearch.p.rapidapi.com/search');
      url.searchParams.set('query', query);
      url.searchParams.set('num_pages', '1');
      url.searchParams.set('country', 'sa');
      url.searchParams.set('date_posted', 'week');
      const res  = await fetch(url.toString(), {
        headers: { 'X-RapidAPI-Key': JSEARCH_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
      });
      if (!res.ok) { console.error('[JSearch] Error:', res.status); continue; }
      const data = await res.json();
      for (const j of (data.data || [])) {
        if (j.job_country && j.job_country !== 'Saudi Arabia') continue;
        const salary = j.job_min_salary && j.job_max_salary
          ? j.job_min_salary + '-' + j.job_max_salary + ' ' + (j.job_salary_currency||'SAR') : '';
        const type = j.job_employment_type === 'FULLTIME' ? 'full-time' :
                     j.job_employment_type === 'PARTTIME' ? 'part-time' :
                     j.job_employment_type === 'CONTRACTOR' ? 'contract' : 'full-time';
        const ok = await saveJob(j.job_title, j.employer_name,
          j.job_city || j.job_state, j.job_description, j.job_apply_link, type, salary);
        if (ok) saved++;
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) { console.error('[JSearch] Error:', e.message); }
  }
  console.log('[JSearch] Saved:', saved, 'new jobs');
  return saved;
}

/* ════════════════════════════════════════════════════════
   SOURCE 2 — Adzuna API
════════════════════════════════════════════════════════ */
const ADZUNA_QUERIES = ["safety officer HSE Saudi Arabia","QC inspector Saudi Arabia","permit receiver WPR Saudi Arabia","construction supervisor Saudi Arabia","civil engineer Saudi Arabia","scaffolding rigger Saudi Arabia","welder fabricator Saudi Arabia","site engineer Saudi Arabia","NDT inspector Saudi Arabia","electrical technician Saudi Arabia"];

async function runAdzuna() {
  if (!ADZUNA_ID || !ADZUNA_KEY) { console.log('[Adzuna] No API keys — skipping'); return 0; }
  let saved = 0;
  for (const query of ADZUNA_QUERIES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${ADZUNA_ID}&app_key=${ADZUNA_KEY}&results_per_page=10&what=${encodeURIComponent(query)}&content-type=application/json`;
      const res  = await fetch(url);
      if (!res.ok) { console.error('[Adzuna] Error:', res.status, await res.text()); continue; }
      const data = await res.json();
      for (const j of (data.results || [])) {
        const ok = await saveJob(
          j.title,
          j.company?.display_name || 'Company',
          j.location?.display_name || 'Saudi Arabia',
          j.description || '',
          j.redirect_url || '',
          'full-time',
          j.salary_min && j.salary_max ? j.salary_min + '-' + j.salary_max + ' SAR' : ''
        );
        if (ok) saved++;
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch(e) { console.error('[Adzuna] Error:', e.message); }
  }
  console.log('[Adzuna] Saved:', saved, 'new jobs');
  return saved;
}

/* ════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════ */
async function runScraper() {
  console.log('[Scraper] Starting —', new Date().toISOString());
  const j = await runJSearch();
  const a = await runAdzuna();
  console.log('[Scraper] Total saved:', j + a, 'new jobs');
  process.exit(0);
}

runScraper().catch(e => { console.error('[Scraper] Fatal:', e.message); process.exit(1); });
