/* ══════════════════════════════════════════════════════════
   jobs-scraper.js — Auto-fetch Saudi jobs from JSearch API
   Categories matched dynamically from database
══════════════════════════════════════════════════════════ */
require('dotenv').config();
const db = require('./db/connection');

const JSEARCH_KEY = process.env.JSEARCH_API_KEY;

// ── Match job title to closest category from DB ──────────
async function getCategoryId(title) {
  const [cats] = await db.query('SELECT id, name, slug FROM categories');
  const t = (title || '').toLowerCase();

  // Try to find best matching category by keywords
  let bestId = cats[0]?.id || 1;
  let bestScore = 0;

  for (const cat of cats) {
    const keywords = cat.slug.replace(/-/g,' ').toLowerCase().split(' ')
      .concat(cat.name.toLowerCase().split(/[\s\/]+/));

    let score = 0;
    for (const kw of keywords) {
      if (kw.length > 2 && t.includes(kw)) score++;
    }
    if (score > bestScore) { bestScore = score; bestId = cat.id; }
  }

  // If no match found use "Other Specialists" or last category
  if (bestScore === 0) {
    const other = cats.find(c => c.slug.includes('other') || c.slug.includes('specialist'));
    if (other) bestId = other.id;
  }

  return bestId;
}

// ── Generate slug ─────────────────────────────────────────
function makeSlug(title, company) {
  return (title + '-' + company)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) + '-' + Date.now().toString(36);
}

// ── Search queries for Saudi Arabia ──────────────────────
const SEARCH_QUERIES = [
  'jobs in Saudi Arabia',
  'engineering jobs Saudi Arabia',
  'construction jobs Saudi Arabia',
  'oil and gas jobs Saudi Arabia Aramco',
  'healthcare nursing jobs Saudi Arabia',
  'IT software jobs Saudi Arabia Riyadh',
  'finance accounting jobs Saudi Arabia',
  'hospitality hotel jobs Saudi Arabia',
];

// ── Fetch jobs from JSearch ───────────────────────────────
async function fetchJobs(query) {
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('num_pages', '1');
  url.searchParams.set('country', 'sa');
  url.searchParams.set('date_posted', 'week');

  const res = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key':  JSEARCH_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });

  if (!res.ok) {
    console.error('[JSearch] Error:', res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return data.data || [];
}

// ── Save job to database ──────────────────────────────────
async function saveJob(job) {
  const title     = (job.job_title || '').slice(0, 200);
  const company   = (job.employer_name || 'Company').slice(0, 200);
  const location  = (job.job_city || job.job_state || 'Saudi Arabia').slice(0, 200);
  const desc      = job.job_description || '';
  const applyLink = job.job_apply_link || '';
  const jobType   = job.job_employment_type === 'FULLTIME'    ? 'full-time' :
                    job.job_employment_type === 'PARTTIME'    ? 'part-time' :
                    job.job_employment_type === 'CONTRACTOR'  ? 'contract'  : 'full-time';
  const salary    = job.job_min_salary && job.job_max_salary
                    ? job.job_min_salary + ' - ' + job.job_max_salary + ' ' + (job.job_salary_currency || 'SAR')
                    : '';
  const slug      = makeSlug(title, company);
  const catId     = await getCategoryId(title);

  // Skip duplicates
  const [existing] = await db.query(
    'SELECT id FROM jobs WHERE title = ? AND company = ? LIMIT 1',
    [title, company]
  );
  if (existing.length) return false;

  await db.query(
    `INSERT INTO jobs (title, company, category_id, location, job_type, description,
      apply_link, salary, status, slug, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,'active',?,NOW(),NOW())`,
    [title, company, catId, location, jobType, desc, applyLink, salary, slug]
  );
  return true;
}

// ── Main ──────────────────────────────────────────────────
async function runScraper() {
  if (!JSEARCH_KEY) { console.error('[Scraper] JSEARCH_API_KEY not set'); process.exit(1); }
  console.log('[Scraper] Starting —', new Date().toISOString());
  let fetched = 0, saved = 0;

  for (const query of SEARCH_QUERIES) {
    try {
      console.log('[Scraper] Querying:', query);
      const jobs = await fetchJobs(query);
      fetched += jobs.length;
      for (const job of jobs) {
        if (job.job_country && job.job_country !== 'Saudi Arabia') continue;
        const ok = await saveJob(job);
        if (ok) saved++;
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.error('[Scraper] Error:', e.message);
    }
  }

  console.log('[Scraper] Done — Fetched:', fetched, '| Saved:', saved, 'new jobs');
  process.exit(0);
}

runScraper().catch(e => { console.error(e.message); process.exit(1); });
