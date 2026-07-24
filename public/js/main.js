/* ════════════════════════════════════════════════════════════
   HIREHUB – MAIN.JS
   Handles: settings, theme, jobs, filters, modal, pagination,
            SEO meta + schema.org injection, shareable URLs
════════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────
const state = {
  jobs:         [],
  categories:   [],
  settings:     {},
  page:         1,
  totalPages:   1,
  totalJobs:    0,
  viewMode:     'grid',
  filters: {
    q:        '',
    location: '',
    category: '',
    type:     '',
    sort:     'newest',
    salary:   '',   // Phase 1: salary range
    visa:     '',   // Phase 1: visa sponsorship
    date:     "",   // Phase 1: days since posted
    iqama:    "",   // Phase 2: transferable iqama
    immediate:"",   // Phase 2: immediate joining
    local:    ""    // Phase 2: local hiring
  }
};

// ── Simple in-memory cache ─────────────────────────────────────
const _cache = {};
async function cachedGet(url, ttlMs = 60000) {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < ttlMs) return _cache[url].data;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  _cache[url] = { data, ts: now };
  return data;
}

// ── API helpers ────────────────────────────────────────────────
const api = {
  get: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};

// ── DOM helpers ────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

// ── Date formatting ────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return mins <= 1 ? 'Just now' : mins + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

// ── WhatsApp link builder ──────────────────────────────────────
//function waLink(number, jobTitle) {
 // const clean = number.replace(/\D/g, '');
 // const msg   = encodeURIComponent(`Hi, I'm interested in the "${jobTitle}" position.`);
  //return `https://wa.me/${clean}?text=${msg}`;
//}
function waLink(job) {
  // Use WhatsApp number if available, otherwise fallback to phone
  const number = job.whatsapp || job.phone;
  if (!number) return '#';

  const clean = number.replace(/\D/g, '');
  const siteUrl = (window.state?.settings?.site_url || window.location.origin).replace(/\/$/, '');
  const jobUrl = `${siteUrl}/job/${job.slug}`;

  const postedDate = new Date(job.created_at).toLocaleDateString('en-GB'); // DD/MM/YYYY

  const msg = `*Job Inquiry: ${job.title}*\n\n` +
    `🏢 *Company:* ${job.company}\n` +
    `📍 *Location:* ${job.location}\n` +
    `💼 *Job Type:* ${job.job_type || 'Full-time'}\n` +
   // `📅 *Posted:* ${postedDate}\n\n` +
    `🔗 *View full job:* ${jobUrl}\n\n` +
    `Hello, I am very interested in this position. Please find my details attached. Thank you.`;

  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}
// ── Security: HTML escape ──────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ══════════════════════════════════════════════════════════════
   SEO HELPERS
══════════════════════════════════════════════════════════════ */

/** Set or create a <meta> tag */
function setMeta(attr, name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Inject / update a JSON-LD <script> block */
function setJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id   = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}

/** Update the canonical <link> */
function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = url;
}

// ── Inject site-level schema (called once after settings load) ─
function injectSiteSchema() {
  const s       = state.settings;
  const siteUrl = (s.site_url || window.location.origin).replace(/\/$/, '');
  const name    = s.site_name || 'HireHub';
  const desc    = s.site_description || 'Find your next career opportunity';

  setJsonLd('schema-website', {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    name,
    url:         siteUrl,
    description: desc,
    potentialAction: {
      '@type':      'SearchAction',
      target:       { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  });

  setJsonLd('schema-org', {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name,
    url:         siteUrl,
    description: desc,
    logo: { '@type': 'ImageObject', url: `${siteUrl}/JobOrbitFavicon.png` },
          sameAs: ['https://linkedin.com/company/joborbit-gulf', 'https://www.facebook.com/profile.php?id=61576669636551', 'https://whatsapp.com/channel/0029Vb84k2k96H4JWs3NXe11'],
          contactPoint: {
      '@type':      'ContactPoint',
      contactType:  'customer service',
      url:          `${siteUrl}/contact.html`
    }
  });

  // Google Search Console verification
  if (s.google_verify) setMeta('name', 'google-site-verification', s.google_verify);

  // OG image
  const ogImg = s.og_image || s.logo_url || `${siteUrl}/JobOrbitFavicon.png`;
  setMeta('property', 'og:image', ogImg);
  setMeta('name', 'twitter:image', ogImg);

  // Twitter handle
  if (s.twitter_handle) setMeta('name', 'twitter:site', s.twitter_handle);
}

// ── Update meta tags dynamically as filters change ─────────────
function updateMetaTags() {
  const s       = state.settings;
  const siteUrl = (s.site_url || window.location.origin).replace(/\/$/, '');
  const name    = s.site_name || 'HireHub';
  const f       = state.filters;

  let title, desc, canonical;

  // Build contextual title/description from active filters
  const parts = [];
  if (f.q)    parts.push(`"${f.q}"`);
  if (f.type) parts.push(f.type);

  // Try to resolve category slug → name
  if (f.category) {
    const cat = state.categories.find(c =>
      c.slug === f.category || String(c.id) === String(f.category)
    );
    if (cat) parts.push(cat.name);
  }
  if (f.location) parts.push(`in ${f.location}`);

  if (parts.length) {
    const label = parts.join(' ');
    title    = `${label} Jobs – ${name}`;
    desc     = `Find ${label} jobs on ${name}. ${state.totalJobs ? state.totalJobs + ' listings' : 'Multiple listings'} with direct recruiter contact via WhatsApp, phone, or email.`;
    const qp = new URLSearchParams();
    if (f.q)        qp.set('q', f.q);
    if (f.category) qp.set('category', f.category);
    if (f.location) qp.set('location', f.location);
    if (f.type)     qp.set('type', f.type);
    canonical = `${siteUrl}/?${qp.toString()}`;
  } else {
    title    = `${name} – Find Your Next Career Opportunity`;
    desc     = s.site_description || `Browse ${state.totalJobs ? state.totalJobs + ' job listings' : 'thousands of jobs'} across tech, marketing, finance and more. Connect directly with recruiters.`;
    canonical = `${siteUrl}/`;
  }

  // Apply to document
  document.title = title;
  setCanonical(canonical);
  setMeta('name',     'description',      desc);
  setMeta('property', 'og:title',         title);
  setMeta('property', 'og:description',   desc);
  setMeta('property', 'og:url',           canonical);
  setMeta('property', 'og:site_name',     name);
  setMeta('name',     'twitter:title',    title);
  setMeta('name',     'twitter:description', desc);

  // Update URL bar without page reload (shareable filtered pages)
  const qp = new URLSearchParams();
  if (f.q)               qp.set('q',        f.q);
  if (f.category)        qp.set('category', f.category);
  if (f.location)        qp.set('location', f.location);
  if (f.type)            qp.set('type',     f.type);
  if (f.sort !== 'newest') qp.set('sort',   f.sort);
  if (state.page > 1)    qp.set('page',     state.page);
  const qs = qp.toString();
  history.replaceState(null, '', qs ? `/?${qs}` : '/');
}

// ── JobPosting + ItemList schema (updated after each job load) ─
function updateSchema(jobs) {
  const s       = state.settings;
  const siteUrl = (s.site_url || window.location.origin).replace(/\/$/, '');
  const name    = s.site_name || 'HireHub';
  const country = s.country_code || 'US';

  const empTypeMap = {
    'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME',
    'Contract':  'CONTRACTOR', 'Freelance': 'CONTRACTOR', 'Remote': 'FULL_TIME'
  };

  setJsonLd('schema-list', {
    '@context':      'https://schema.org',
    '@type':         'ItemList',
    name:            `${name} Job Listings`,
    url:             `${siteUrl}/`,
    numberOfItems:   state.totalJobs,
    itemListElement: jobs.slice(0, 20).map((job, i) => ({
      '@type':   'ListItem',
      position:  i + 1,
      url:       `${siteUrl}/job/${job.slug}`,
      item: {
        '@type':         'JobPosting',
        title:            job.title,
        description:      job.description.substring(0, 500),
        datePosted:       new Date(job.created_at).toISOString().split('T')[0],
        validThrough:     new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        employmentType:   empTypeMap[job.job_type] || 'FULL_TIME',
        url:              `${siteUrl}/job/${job.slug}`,
        directApply:      !!(job.phone || job.whatsapp || job.email),
        identifier:       { '@type': 'PropertyValue', name, value: String(job.id) },
        hiringOrganization: { '@type': 'Organization', name: job.company, sameAs: siteUrl },
        jobLocation: {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: country }
        }
      }
    }))
  });

  // BreadcrumbList
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
    { '@type': 'ListItem', position: 2, name: 'Jobs',  item: `${siteUrl}/` }
  ];
  if (state.filters.category) {
    const cat = state.categories.find(c =>
      c.slug === state.filters.category || String(c.id) === String(state.filters.category)
    );
    if (cat) items.push({ '@type': 'ListItem', position: 3, name: cat.name, item: `${siteUrl}/?category=${cat.slug}` });
  }
  setJsonLd('schema-breadcrumb', { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });

  // Sync meta tags too
  updateMetaTags();
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════════════ */
async function loadSettings() {
  try {
    const data = await cachedGet('/api/settings', 300000); // cache 5 min
    state.settings = data.settings;
    const s = state.settings;

    if (s.primary_color) {
      document.documentElement.style.setProperty('--primary', s.primary_color);
      document.documentElement.style.setProperty('--primary-hover', s.primary_color + 'cc');
    }
    if (s.secondary_color) {
      document.documentElement.style.setProperty('--secondary', s.secondary_color);
    }

    if (s.site_name) {
      $$('.brand-name').forEach(el => { el.textContent = s.site_name; });
      $('#footer-site-name').textContent = s.site_name;
      $('#footer-copy-name').textContent = s.site_name;
      setMeta('property', 'og:site_name', s.site_name);
    }

    if (s.hero_title)    $('#hero-title').textContent    = s.hero_title;
    if (s.hero_subtitle) $('#hero-subtitle').textContent = s.hero_subtitle;

    if (s.logo_url) {
      const logo = $('#site-logo');
      logo.src = s.logo_url;
      logo.classList.remove('d-none');
    }

    const savedTheme = localStorage.getItem('theme') || s.default_theme || 'light';
    applyTheme(savedTheme, false);

    loadAds(s);

    // Inject site-level SEO schema now that settings are loaded
    injectSiteSchema();

  } catch (e) {
    console.warn('Settings load failed:', e);
  }
}

// Homepage ad zones (top/sidebar/between_jobs section banner). The footer
// zone is handled independently in footer.html since that partial is shared
// on every page, not just this one. The between_jobs *zone* actually backs
// two placements on this page: this static banner (#ad-between-jobs, sitting
// once between the "Job of the Day" section and the grid) and a second,
// dynamically-recreated inline slot inside the grid itself — see
// injectInlineBetweenJobsAd() below, which reuses the same ad_code. A zone
// only shows if the admin has both enabled it in Monetization AND (for
// top/sidebar, which predate the ads feed) left the matching Section
// Visibility toggle on.
async function loadAds(settings) {
  try {
    const data = await cachedGet('/api/ads', 300000); // cache 5 min
    const ads = data.ads || {};
    const zones = [
      { zone: 'top',          wrapId: 'ad-top',          codeId: 'ad-top-code',          gate: settings.show_banner_top  === '1' },
      { zone: 'sidebar',      wrapId: 'ad-sidebar',      codeId: 'ad-sidebar-code',      gate: settings.show_banner_side === '1' },
      { zone: 'between_jobs', wrapId: 'ad-between-jobs', codeId: 'ad-between-jobs-code', gate: true }
    ];
    zones.forEach(({ zone, wrapId, codeId, gate }) => {
      const code = ads[zone];
      if (!code || !gate) return;
      const wrap = document.getElementById(wrapId);
      const slot = document.getElementById(codeId);
      if (wrap && slot) { slot.innerHTML = code; wrap.classList.remove('d-none'); }
    });
  } catch (e) { /* ads are non-critical — fail silently */ }
}

// The inline between-jobs ad sits inside #jobsList, which loadJobs() replaces
// wholesale on every search/filter/sort/page change — so unlike the static
// banner above (which loadAds() only ever needs to touch once), this one has
// to be (re-)injected after every render. It intentionally uses its own
// #ad-inline-between-jobs id (distinct from the static banner's
// #ad-between-jobs) — the two used to share an id, which meant
// getElementById() always resolved to whichever came first in the DOM and
// the in-grid slot could never actually be populated. cachedGet reuses the
// 5-minute in-memory cache from loadAds(), so this doesn't cost an extra
// request per render.
async function injectInlineBetweenJobsAd() {
  try {
    const data = await cachedGet('/api/ads', 300000);
    const code = data.ads && data.ads.between_jobs;
    if (!code) return;
    const wrap = document.getElementById('ad-inline-between-jobs');
    const slot = document.getElementById('ad-inline-between-jobs-code');
    if (wrap && slot) { slot.innerHTML = code; wrap.classList.remove('d-none'); }
  } catch (e) { /* ads are non-critical — fail silently */ }
}

/* ══════════════════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════════════════ */
function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon');
  icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  // Sync mobile bottom nav icon
  const mbnIcon = document.getElementById('mbnThemeIcon');
  if (mbnIcon) mbnIcon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ══════════════════════════════════════════════════════════════
   CATEGORIES
══════════════════════════════════════════════════════════════ */
async function loadCategories() {
  try {
    const data = await cachedGet('/api/jobs/categories', 120000); // cache 2 min
    state.categories = data.categories;

    const catFilter = $('#categoryFilter');
    state.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = `${c.name} (${c.count})`;
      catFilter.appendChild(opt);
    });

    $('#stat-cats').textContent = state.categories.length;

    const sidebarCats = $('#sidebarCats');
    state.categories.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${c.name}</span><span class="cat-badge">${c.count}</span>`;
      li.addEventListener('click', () => filterByCategory(c.slug));
      sidebarCats.appendChild(li);
    });

    // Sync with URL param if set
    if (state.filters.category) {
      catFilter.value = state.filters.category;
    }
  } catch (e) {
    console.warn('Categories load failed:', e);
  }
}

function filterByCategory(slug) {
  state.filters.category = slug;
  state.page = 1;
  $('#categoryFilter').value = slug;
  loadJobs();
  toggleClearBtn();
  document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
}

/* ══════════════════════════════════════════════════════════════
   FEATURED JOBS
══════════════════════════════════════════════════════════════ */
async function loadFeaturedJobs() {
  if (state.settings.show_featured === '0') {
    $('#featured').classList.add('d-none');
    return;
  }
  try {
    const data = await api.get('/api/jobs/featured');
    const container = $('#featuredList');

    if (!data.jobs || data.jobs.length === 0) {
      $('#featured').classList.add('d-none');
      return;
    }

    container.innerHTML = data.jobs.map(job => `
      <div class="col-md-6 col-lg-4">${renderJobCard(job, true)}</div>
    `).join('');

    data.jobs.forEach(job => {
      if (!state.jobs.find(j => j.id === job.id)) state.jobs.push(job);
    });

    container.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('a')) openJobModal(card.dataset.id);
      });
    });
  } catch (e) {
    $('#featured').classList.add('d-none');
  }
}

/* ══════════════════════════════════════════════════════════════
   LOAD JOBS
══════════════════════════════════════════════════════════════ */
async function loadJobs() {
  const spinner     = $('#loadingSpinner');
  const list        = $('#jobsList');
  const emptyState  = $('#emptyState');
  const pagination  = $('#paginationWrap');
  const resultsInfo = $('#resultsInfo');

  // Phase 2: use skeleton screens instead of spinner
  spinner.classList.add('d-none');
  showSkeletons(6);
  emptyState.classList.add('d-none');
  pagination.classList.add('d-none');

  // Phase 2: track search history
  if (state.filters.q) addToSearchHistory(state.filters.q);

  try {
    const params = new URLSearchParams({
      q:        state.filters.q,
      location: state.filters.location,
      category: state.filters.category,
      type:     state.filters.type,
      sort:     state.filters.sort,
      salary:   state.filters.salary,
      visa:     state.filters.visa,
      date:     state.filters.date,
      iqama:    state.filters.iqama,
      immediate:state.filters.immediate,
      local:    state.filters.local,
      page:     state.page,
      limit:    state.settings.jobs_per_page || 12
    });
    [...params.keys()].forEach(k => { if (!params.get(k)) params.delete(k); });

    const data = await api.get(`/api/jobs?${params}`);

    spinner.classList.add('d-none');
    state.totalJobs  = data.total;
    state.totalPages = data.pages;
    $('#stat-total').textContent = data.total;

    if (data.jobs.length === 0) {
      emptyState.classList.remove('d-none');
      resultsInfo.textContent = 'No jobs found';
      updateMetaTags();
      return;
    }

    resultsInfo.textContent = `Showing ${data.jobs.length} of ${data.total} jobs`;
    state.jobs = data.jobs;

    list.className = state.viewMode === 'list' ? 'row g-3 list-view' : 'row g-3';
    list.innerHTML = data.jobs.map((job, idx) => {
      const adInsert = (idx === 5 && state.page === 1)
        ? '<div class="col-12"><div id="ad-inline-between-jobs" class="ad-zone ad-between-jobs d-none text-center"><span class="ad-label">Advertisement</span><div id="ad-inline-between-jobs-code"></div></div></div>'
        : '';
      return `${adInsert}<div class="col-md-6 col-lg-${state.viewMode === 'list' ? '12' : '6'}">${renderJobCard(job)}</div>`;
    }).join('');

    list.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('a')) openJobModal(card.dataset.id);
      });
    });

    injectInlineBetweenJobsAd(); // #ad-inline-between-jobs was just recreated above — fill it in

    updateSchema(data.jobs); // updates schema + meta + URL bar

    if (data.pages > 1) {
      buildPagination(data.page, data.pages);
      pagination.classList.remove('d-none');
    }
  } catch (e) {
    spinner.classList.add('d-none');
    list.innerHTML = `<div class="col-12 text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>Failed to load jobs. Please refresh.</div>`;
    console.error('Jobs load error:', e);
  }
}

/* ══════════════════════════════════════════════════════════════
   RENDER JOB CARD
══════════════════════════════════════════════════════════════ */
function renderJobCard(job, isFeaturedSection = false) {
  const isFeatured  = job.featured  == 1 && state.settings.show_featured  !== '0';
  const isSponsored = job.sponsored == 1 && state.settings.show_sponsored !== '0';

  // ── Urgency logic ─────────────────────────────────────────
  const daysOld        = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000);
  const isNew          = daysOld <= 1;
  const isUrgent       = job.urgent == 1 || /urgent|immediately|asap/i.test(job.title || '');
  const isExpiring     = daysOld >= 25 && daysOld < 30;
  const isMaybeExpired = daysOld >= 30;

  let cardClass = 'job-card';
  if (isFeatured)     cardClass += ' featured-card';
  if (isSponsored)    cardClass += ' sponsored-card';
  if (isMaybeExpired) cardClass += ' card-expired';

  // ── Urgency badge (quiet, tinted — not competing with paid badges) ──
  const urgencyBadge = isUrgent       ? '<span class="badge-urgency badge-urgent"><i class="bi bi-exclamation-triangle-fill me-1"></i>Urgent</span>'
                     : isNew          ? '<span class="badge-urgency badge-new"><i class="bi bi-lightning-charge-fill me-1"></i>New Today</span>'
                     : isExpiring     ? '<span class="badge-urgency badge-expiring"><i class="bi bi-hourglass-split me-1"></i>Closing Soon</span>'
                     : isMaybeExpired ? '<span class="badge-urgency badge-expired"><i class="bi bi-exclamation-circle me-1"></i>May Be Expired</span>'
                     : '';
  const iqamaBadge = /transferable/i.test((job.title||"")+(job.description||"")) ? '<span class="card-visa-badge" style="background:rgba(16,185,129,.1);color:#059669;border-color:rgba(16,185,129,.3)"><i class="bi bi-file-earmark-check me-1"></i>Transferable Iqama</span>' : "";
  const immediateBadge = /immediate/i.test((job.title||"")+(job.description||"")) ? '<span class="card-visa-badge" style="background:rgba(245,158,11,.1);color:#d97706;border-color:rgba(245,158,11,.3)"><i class="bi bi-lightning-fill me-1"></i>Immediate Joining</span>' : "";

  // Tier 1 — paid/trust status badges (top row, solid, highest emphasis)
  const statusBadges = [
    isSponsored  ? '<span class="badge-sponsored"><i class="bi bi-megaphone-fill me-1"></i>Sponsored</span>' : '',
    isFeatured   ? '<span class="badge-featured"><i class="bi bi-star-fill me-1"></i>Featured</span>'   : '',
    job.verified == 1 ? '<span class="badge-verified"><i class="bi bi-patch-check-fill me-1"></i>Verified</span>' : '',
    urgencyBadge
  ].filter(Boolean).join('');

  // Tier 2 — quiet meta badges (second row, under the title/company)
  const metaBadges = [
    job.category ? `<span class="badge-category">${escHtml(job.category)}</span>` : '',
    `<span class="badge-type">${escHtml(job.job_type || 'Full-time')}</span>`
  ].filter(Boolean).join('');

  // ── Visa sponsored badge ──────────────────────────────────
  const visaHtml = job.visa_sponsored
    ? `<span class="card-visa-badge"><i class="bi bi-passport me-1"></i>Visa Sponsored</span>`
    : '';
  const highlightsHtml = [visaHtml, iqamaBadge, immediateBadge].filter(Boolean).join('');

  // ── City flag ─────────────────────────────────────────────
  const cityFlag   = getCityFlag(job.location);
  const salaryMeta = job.salary ? `<span class="meta-item meta-item-salary"><i class="bi bi-cash-stack"></i>${escHtml(job.salary)}</span>` : "";
  const locationHtml = `<span class="meta-item"><i class="bi bi-geo-alt"></i>${cityFlag}${escHtml(job.location)}</span>`;

  // ── Company logo / initial avatar (falls back to initial if the
  // logo file is missing, e.g. deleted upload) ──────────────────
  const companyInitial = escHtml((job.company || '?').trim().charAt(0).toUpperCase() || '?');
  const logoHtml = job.employer_logo
    ? `<img src="${escHtml(job.employer_logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${companyInitial}'))">`
    : companyInitial;

  // ── Contact icons ─────────────────────────────────────────
  const isSaved = isJobSaved(job.id);
  const saveBtnHtml = `<button type="button" class="btn-contact-icon btn-save-icon${isSaved ? ' saved' : ''}" title="${isSaved ? 'Remove from saved' : 'Save job'}" aria-label="${isSaved ? 'Remove from saved jobs' : 'Save job'}" onclick="event.stopPropagation();toggleSaveJobById(${job.id})"><i class="bi ${isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i></button>`;

  const contacts = [
    saveBtnHtml,
    job.phone     ? `<a href="tel:${job.phone}" class="btn-contact-icon phone" title="Call" onclick="event.stopPropagation()"><i class="bi bi-telephone-fill"></i></a>` : '',
    job.whatsapp  ? `<a href="${waLink(job)}" class="btn-contact-icon whatsapp" title="WhatsApp" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="bi bi-whatsapp"></i></a>` : '',
    job.map_link  ? `<a href="${escHtml(job.map_link)}" class="btn-contact-icon map" title="View on Map" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : '',
    job.email     ? `<a href="mailto:${job.email}" class="btn-contact-icon email" title="Email" onclick="event.stopPropagation()"><i class="bi bi-envelope-fill"></i></a>` : '',
    job.apply_link ? `<a href="${escHtml(job.apply_link)}" class="btn-contact-icon applylink" title="Apply Link" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="bi bi-box-arrow-up-right"></i></a>` : ''
  ].filter(Boolean).join('');

  // ── Primary action — explicit "View" button (still a real link to the
  // SSR job page for crawlability/share-ability, just no longer a tiny
  // icon buried among the other contact icons) ──────────────────────
  const viewBtnHtml = job.slug
    ? `<a href="/job/${job.slug}" class="btn-view-details" title="View Full Details" onclick="event.stopPropagation()">View<i class="bi bi-arrow-right ms-1"></i></a>`
    : '';

  // ── Trust Score badge — lives in the footer, not the top badge row ──
  const trustScore = calcTrustScore(job);
  const trustHtml  = trustScore
    ? `<span class="trust-score trust-${trustScore.level}" title="Employer transparency score">
         <i class="bi bi-shield-check me-1"></i>${trustScore.label}
       </span>` : '';

  return `
    <div class="${cardClass}" data-id="${job.id}" data-slug="${job.slug || ''}" role="button" tabindex="0"
         aria-label="View ${escHtml(job.title)} at ${escHtml(job.company)}">
      <div class="card-badges">${statusBadges}</div>
      <button type="button" class="btn-report-job" title="Report this listing" aria-label="Report this listing"
        data-slug="${job.slug || ''}" data-title="${escHtml(job.title)}"
        onclick="event.stopPropagation();reportJobCard(this)">
        <i class="bi bi-flag"></i>
      </button>
      <div class="card-identity">
        <div class="card-logo">${logoHtml}</div>
        <div class="card-identity-text">
          <div class="card-title">${escHtml(job.title)}</div>
          <div class="card-company">${escHtml(job.company)}</div>
        </div>
      </div>
      <div class="card-badges card-badges-meta">${metaBadges}</div>
      ${highlightsHtml ? `<div class="card-highlights">${highlightsHtml}</div>` : ""}
      <div class="card-meta">${locationHtml}${salaryMeta}</div>
      <p class="card-desc">${escHtml(job.description)}</p>
      <div class="card-footer-row">
        <div class="footer-meta-left">
          ${trustHtml}
          <span class="card-date"><i class="bi bi-clock me-1"></i>${timeAgo(job.created_at)}</span>
        </div>
        <div class="card-actions d-flex align-items-center gap-1">
          <div class="card-contacts">${contacts}</div>
          ${viewBtnHtml}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   CITY FLAG + CITIES SECTION
══════════════════════════════════════════════════════════════ */
function getCityFlag(location) {
  if (!location) return '';
  const loc = location.toLowerCase();
  if (/riyadh|jeddah|dammam|mecca|medina|khobar|tabuk|ksa|saudi/i.test(loc)) return '🇸🇦 ';
  if (/dubai|abu dhabi|sharjah|ajman|uae|emirates/i.test(loc))               return '🇦🇪 ';
  if (/doha|qatar/i.test(loc))                                                return '🇶🇦 ';
  if (/kuwait/i.test(loc))                                                    return '🇰🇼 ';
  if (/bahrain|manama/i.test(loc))                                            return '🇧🇭 ';
  if (/muscat|oman/i.test(loc))                                               return '🇴🇲 ';
  return '';
}

/* ══════════════════════════════════════════════════════════════
   PHASE 6 — TRUST SCORE
   Scores each job by how much info the employer provided
══════════════════════════════════════════════════════════════ */
function calcTrustScore(job) {
  let score = 0;
  if (job.salary)         score += 25;  // salary disclosed
  if (job.visa_sponsored) score += 20;  // visa status clear
  if (job.phone)          score += 10;  // direct phone
  if (job.whatsapp)       score += 10;  // WhatsApp contact
  if (job.email)          score += 10;  // email contact
  if (job.map_link)       score += 10;  // location verified
  if (job.description && job.description.length > 200) score += 15; // detailed JD
  if (score === 0) return null;
  if (score >= 70) return { level: 'high',   label: 'Transparent' };
  if (score >= 40) return { level: 'medium', label: 'Partial Info' };
  return               { level: 'low',    label: 'Basic Listing' };
}

/* ══════════════════════════════════════════════════════════════
   JOB MODAL
══════════════════════════════════════════════════════════════ */
// async function openJobModal(jobId) {
//   const cached = state.jobs.find(j => j.id == jobId);
//   if (cached) {
//     populateModal(cached);
//     new bootstrap.Modal($('#jobModal')).show();
//     return;
//   }

//   try {
//     const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
//     const slug = card ? card.dataset.slug : null;
//     if (!slug) return;
//     const data = await api.get(`/api/jobs/${slug}`);
//     if (!data.success) return;
//     state.jobs.push(data.job);
//     populateModal(data.job);
//     new bootstrap.Modal($('#jobModal')).show();
//   } catch (e) {
//     console.warn('Could not load job details:', e);
//   }
// }


async function openJobModal(jobId) {
  try {
    const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
    const slug = card ? card.dataset.slug : null;
    if (!slug) return;
    await openJobBySlug(slug);
  } catch (e) {
    console.warn(e);
  }
}

// Opens modal directly from a slug — used by Job of the Day,
// Recently Viewed, Similar Jobs, and any card without a .job-card wrapper
async function openJobBySlug(slug) {
  try {
    if (!slug) return;
    const data = await api.get(`/api/jobs/${slug}`);
    if (!data.success) return;
    trackRecentlyViewed(data.job);
    populateModal(data.job);
    bootstrap.Modal.getOrCreateInstance($('#jobModal')).show();
    if (window.jbTrack) window.jbTrack('job_view', { job_id: data.job.id });
  } catch (e) {
    console.warn('[openJobBySlug]', e);
  }
}

function populateModal(job) {
  state.currentModalJob = job;
  const saveBtn = $('#modalSaveBtn');
  if (saveBtn) {
    const saved = isJobSaved(job.id);
    saveBtn.classList.toggle('saved', saved);
    const icon = saveBtn.querySelector('i');
    if (icon) icon.className = saved ? 'bi bi-bookmark-fill me-1' : 'bi bi-bookmark me-1';
    const label = saveBtn.querySelector('.btn-save-label');
    if (label) label.textContent = saved ? 'Saved' : 'Save';
  }
  const badges = [
    job.sponsored == 1 && state.settings.show_sponsored !== '0' ? '<span class="badge-sponsored"><i class="bi bi-megaphone-fill me-1"></i>Sponsored</span>' : '',
    job.featured  == 1 && state.settings.show_featured  !== '0' ? '<span class="badge-featured"><i class="bi bi-star-fill me-1"></i>Featured</span>' : '',
    job.verified == 1 ? '<span class="badge-verified"><i class="bi bi-patch-check-fill me-1"></i>Verified</span>' : ''
  ].filter(Boolean).join('');

  $('#modalBadges').innerHTML     = badges;
  $('#modalTitle').textContent    = job.title;
  $('#modalCompany').textContent  = job.company;
  $('#modalLocation').textContent = job.location;
  $('#modalType').textContent     = job.job_type || 'Full-time';
  $('#modalCategory').textContent = job.category;
  $('#modalPosted').textContent   = `Posted ${timeAgo(job.created_at)}`;

  const logoEl = $('#modalLogoAvatar');
  if (logoEl) {
    const companyInitial = escHtml((job.company || '?').trim().charAt(0).toUpperCase() || '?');
    logoEl.innerHTML = job.employer_logo
      ? `<img src="${escHtml(job.employer_logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${companyInitial}'))">`
      : companyInitial;
  }

  const salaryWrap = $('#modalSalaryWrap');
  if (salaryWrap) {
    if (job.salary) {
      $('#modalSalary').textContent = job.salary;
      salaryWrap.classList.remove('d-none');
    } else {
      salaryWrap.classList.add('d-none');
    }
  }

  const descEl = $('#modalDescription');
  descEl.innerHTML = escHtml(job.description)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  if (!descEl.innerHTML.startsWith('<p>')) {
    descEl.innerHTML = '<p>' + descEl.innerHTML + '</p>';
  }

  // Requirements (shown only if the employer provided them)
  const reqWrap = $('#modalRequirementsWrap');
  const reqEl   = $('#modalRequirements');
  if (job.requirements && job.requirements.trim()) {
    reqEl.innerHTML = escHtml(job.requirements)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    if (!reqEl.innerHTML.startsWith('<p>')) {
      reqEl.innerHTML = '<p>' + reqEl.innerHTML + '</p>';
    }
    reqWrap.classList.remove('d-none');
  } else {
    reqWrap.classList.add('d-none');
    reqEl.innerHTML = '';
  }

  // Extra fields
  const extraEl = $('#modalExtraFields');
  if (job.extra_fields && typeof job.extra_fields === 'object' && Object.keys(job.extra_fields).length > 0) {
    const schema   = window.__formSchema || null;
    const labelMap = {};
    if (schema && schema.sections) {
      schema.sections.forEach(sec => {
        (sec.fields || []).forEach(f => {
          if (!f.coreKey) {
            labelMap[f.id]        = f.label || f.id;
            labelMap[f.id+'_min'] = (f.label || f.id) + ' (Min)';
            labelMap[f.id+'_max'] = (f.label || f.id) + ' (Max)';
          }
        });
      });
    }
    let rows = '';
    Object.entries(job.extra_fields).forEach(([key, val]) => {
      if (!val && val !== 0) return;
      const label      = labelMap[key] || key.replace(/^fld_\w+_/, '').replace(/_/g, ' ');
      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
      rows += `<div class="extra-field-row">
        <span class="extra-field-label">${escHtml(label)}</span>
        <span class="extra-field-value">${escHtml(displayVal)}</span>
      </div>`;
    });
    if (rows) {
      extraEl.innerHTML = `<div class="extra-fields-block">
        <div class="modal-desc-label" style="margin-top:1.25rem"><i class="bi bi-list-check me-2"></i>Additional Details</div>
        ${rows}
      </div>`;
      extraEl.classList.remove('d-none');
    } else {
      extraEl.innerHTML = ''; extraEl.classList.add('d-none');
    }
  } else {
    extraEl.innerHTML = ''; extraEl.classList.add('d-none');
  }

  const phone    = $('#modalPhone');
  const whatsapp = $('#modalWhatsApp');
  const mapBtn   = $('#modalMap');
  const email    = $('#modalEmail');
const applyBtn = $('#modalApplyLink');
  if (job.phone) {
    phone.href = `tel:${job.phone}`;
    phone.innerHTML = `<i class="bi bi-telephone-fill me-1"></i>${job.phone}`;
    phone.classList.remove('d-none');
  } else { phone.classList.add('d-none'); }

  if (job.whatsapp) {
    whatsapp.href = waLink(job);
    whatsapp.innerHTML = `<i class="bi bi-whatsapp me-1"></i>WhatsApp`;
    whatsapp.classList.remove('d-none');
  } else { whatsapp.classList.add('d-none'); }

  if (job.map_link) {
    mapBtn.href = job.map_link;
    mapBtn.classList.remove('d-none');
  } else { mapBtn.classList.add('d-none'); }

  if (job.email) {
    email.href = `mailto:${job.email}`;
    email.innerHTML = `<i class="bi bi-envelope-fill me-1"></i>${job.email}`;
    email.classList.remove('d-none');
  } else { email.classList.add('d-none'); }


// Check that apply_link exists and is not an empty string
if (job.apply_link && job.apply_link.trim() !== '') {
    applyBtn.href = job.apply_link;
    applyBtn.classList.remove('d-none');
} else {
    applyBtn.classList.add('d-none');
}

  // Show "Apply Now" button only for employer-posted jobs
  const applyNowBtn = $('#modalApplyBtn');
  if (applyNowBtn) {
    if (job.employer_id && job.status === 'active') {
      applyNowBtn.classList.remove('d-none');
      applyNowBtn.dataset.jobId = job.id;
      applyNowBtn.dataset.jobTitle = job.title;
    } else {
      applyNowBtn.classList.add('d-none');
    }
  }
  // Update title for context (won't change canonical)
  document.title = `${job.title} at ${job.company} | ${state.settings.site_name || 'HireHub'}`;

  // ── Wire share button ──────────────────────────────────────
  const siteUrl  = (state.settings.site_url || window.location.origin).replace(/\/$/, '');
  const jobUrl   = `${siteUrl}/job/${job.slug}`;
  const siteName = state.settings.site_name || 'HireHub';

  const shareText = buildShareText(job, jobUrl, siteName);
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(jobUrl)}&text=${encodeURIComponent(`${job.title} at ${job.company}\n${job.location} · ${job.job_type || 'Full-time'}`)}`;
  const twShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${job.title} at ${job.company} – ${job.location}`)}&url=${encodeURIComponent(jobUrl)}`;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;

  const shareWA   = document.getElementById('shareWA');
  const shareTG   = document.getElementById('shareTG');
  const shareTW   = document.getElementById('shareTW');
  const shareFB   = document.getElementById('shareFB');
  const shareCopy = document.getElementById('shareCopy');
  const shareBtn  = document.getElementById('modalShareBtn');
  const shareDrop = document.getElementById('modalShareDropdown');

  if (shareWA)   shareWA.href   = waShareUrl;
  if (shareTG)   shareTG.href   = tgShareUrl;
  if (shareTW)   shareTW.href   = twShareUrl;
  if (shareFB)   shareFB.href   = fbShareUrl;

  // Copy link
  if (shareCopy) {
    shareCopy.onclick = async () => {
      try { await navigator.clipboard.writeText(jobUrl); } catch { fallbackCopy(jobUrl); }
      shareCopy.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
      shareCopy.classList.add('copied');
      showShareToast('Link copied to clipboard');
      setTimeout(() => {
        shareCopy.innerHTML = '<i class="bi bi-link-45deg"></i> Copy job link';
        shareCopy.classList.remove('copied');
        shareDrop.classList.remove('open');
      }, 1800);
    };
  }

  // Toggle dropdown or use native share
  if (shareBtn) {
    shareBtn.onclick = async (e) => {
  e.stopPropagation();
  if (navigator.share) {
    try {
      const fullShareText = buildShareText(job, jobUrl, siteName);
      await navigator.share({ title: `${job.title} at ${job.company}`, text: fullShareText, url: jobUrl });
      return;
    } catch (err) { if (err.name === 'AbortError') return; }
  }
  shareDrop.classList.toggle('open');
};
  }
}

/* ══════════════════════════════════════════════════════════════
   SHARE HELPERS
══════════════════════════════════════════════════════════════ */
function buildShareText(job, jobUrl, siteName) {
  // Helper: remove phone numbers and replace with call‑to‑action
  function stripPhoneNumbers(text) {
    let cleaned = text.replace(/(\+?9665|05)\d{8}/g, '')
                      .replace(/(\+\d{1,3}[-.\s]?\d{6,})/g, '')
                      .replace(/\d{4,}[-.\s]?\d{4,}/g, '');
    // If any phone-like pattern was removed, add a placeholder
    if (cleaned !== text) {
      // Avoid adding multiple placeholders
      if (!cleaned.includes('📞 Contact details on website')) {
        cleaned += ' 📞 Contact details on website.';
      }
    }
    return cleaned;
  }

  // Helper: remove email addresses and replace with call‑to‑action
  function stripEmails(text) {
    let cleaned = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');
    if (cleaned !== text) {
      if (!cleaned.includes('✉️ Email on website')) {
        cleaned += ' ✉️ Email on website.';
      }
    }
    return cleaned;
  }

  let desc = (job.description || '').replace(/\n/g, ' ');
  desc = stripPhoneNumbers(desc);
  desc = stripEmails(desc);
  // Also remove common labels like "Contact:" but leave the call‑to‑action
  desc = desc.replace(/Contact:\s*/gi, '')
             .replace(/Phone:\s*/gi, '')
             .replace(/WhatsApp:\s*/gi, '');
  
  const truncatedDesc = desc.substring(0, 200) + (desc.length >= 200 ? '…' : '');
  const notice = `⚠️ *Important Notice:* 
▪ Verify job details before joining
▪ Do NOT pay anyone for job placement
▪ Only deal with verified sources`;

  return `🔥 *Job Opportunity on ${siteName}*\n\n` +
    `📋 *${job.title}*\n` +
    `🏢 ${job.company || 'Not specified'}\n` +
    `📍 ${job.location}\n` +
    `💼 ${job.job_type || 'Full-time'}\n\n` +
    `${truncatedDesc}\n\n` +
    `🔗 View & apply: ${jobUrl}\n\n` +
    `${notice}`;
}

function showShareToast(msg) {
  let t = document.getElementById('shareToastEl');
  if (!t) {
    t = document.createElement('div');
    t.id = 'shareToastEl';
    t.className = 'share-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — RECENTLY VIEWED JOBS (localStorage)
══════════════════════════════════════════════════════════════ */
const RV_KEY = 'jb_recentlyViewed';
const MAX_RV = 5;
const SAVED_KEY = 'jb_savedJobs';
const MAX_SAVED = 50;

function trackRecentlyViewed(job) {
  try {
    let rv = JSON.parse(localStorage.getItem(RV_KEY) || '[]');
    rv = rv.filter(j => j.id !== job.id); // remove duplicate
    rv.unshift({ id: job.id, slug: job.slug, title: job.title, company: job.company, location: job.location, created_at: job.created_at });
    if (rv.length > MAX_RV) rv = rv.slice(0, MAX_RV);
    localStorage.setItem(RV_KEY, JSON.stringify(rv));
    renderRecentlyViewed();
  } catch {}
}

function renderRecentlyViewed() {
  const wrap = document.getElementById('recentlyViewedWrap');
  const list = document.getElementById('recentlyViewedList');
  if (!wrap || !list) return;
  try {
    const rv = JSON.parse(localStorage.getItem(RV_KEY) || '[]');
    if (rv.length === 0) { wrap.classList.add('d-none'); return; }
    wrap.classList.remove('d-none');
    list.innerHTML = rv.map(j => `
      <li class="list-widget-item" onclick="openJobBySlug('${j.slug}')" title="${escHtml(j.title)}">
        <div class="list-widget-title">${escHtml(j.title)}</div>
        <div class="list-widget-meta">${escHtml(j.company)} · ${escHtml(j.location)}</div>
      </li>`).join('');
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   SAVED / BOOKMARKED JOBS (localStorage)
══════════════════════════════════════════════════════════════ */
function isJobSaved(id) {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]').some(j => j.id === id);
  } catch { return false; }
}

function toggleSaveJob(job) {
  try {
    let saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    const idx = saved.findIndex(j => j.id === job.id);
    if (idx >= 0) {
      saved.splice(idx, 1);
    } else {
      saved.unshift({ id: job.id, slug: job.slug, title: job.title, company: job.company, location: job.location, created_at: job.created_at });
      if (saved.length > MAX_SAVED) saved = saved.slice(0, MAX_SAVED);
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    updateSaveButtons(job.id);
    renderSavedJobs();
  } catch {}
}

function toggleSaveJobById(id) {
  let job = state.jobs.find(j => j.id === id);
  if (!job && state.currentModalJob && state.currentModalJob.id === id) job = state.currentModalJob;
  if (!job) return;
  toggleSaveJob(job);
}

function updateSaveButtons(id) {
  const saved = isJobSaved(id);
  document.querySelectorAll(`.job-card[data-id="${id}"] .btn-save-icon`).forEach(btn => {
    btn.classList.toggle('saved', saved);
    btn.title = saved ? 'Remove from saved' : 'Save job';
    const icon = btn.querySelector('i');
    if (icon) icon.className = saved ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
  });
  if (state.currentModalJob && state.currentModalJob.id === id) {
    const modalBtn = $('#modalSaveBtn');
    if (modalBtn) {
      modalBtn.classList.toggle('saved', saved);
      const icon = modalBtn.querySelector('i');
      if (icon) icon.className = saved ? 'bi bi-bookmark-fill me-1' : 'bi bi-bookmark me-1';
      const label = modalBtn.querySelector('.btn-save-label');
      if (label) label.textContent = saved ? 'Saved' : 'Save';
    }
  }
}

function renderSavedJobs() {
  const wrap = document.getElementById('savedJobsWrap');
  const list = document.getElementById('savedJobsList');
  if (!wrap || !list) return;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    wrap.classList.remove('d-none');
    if (saved.length === 0) {
      list.innerHTML = '<li class="text-muted small">No saved jobs yet — tap the bookmark icon on a job to save it here.</li>';
      return;
    }
    list.innerHTML = saved.map(j => `
      <li class="list-widget-item" onclick="openJobBySlug('${j.slug}')" title="${escHtml(j.title)}">
        <div class="list-widget-title">${escHtml(j.title)}</div>
        <div class="list-widget-meta">${escHtml(j.company)} · ${escHtml(j.location)}</div>
        <button type="button" class="list-widget-remove" onclick="event.stopPropagation();removeSavedJob(${j.id})" title="Remove from saved" aria-label="Remove from saved jobs"><i class="bi bi-x-lg"></i></button>
      </li>`).join('');
  } catch {}
}

function reportJobCard(btn) {
  const title = btn.dataset.title || '';
  const slug  = btn.dataset.slug  || '';
  const url   = '/feedback.html?type=report_job'
    + '&subject=' + encodeURIComponent('Job Report: ' + title)
    + '&msg='     + encodeURIComponent(
        'Listing URL: ' + window.location.origin + '/job/' + slug + '\n\nReason: '
      );
  window.location = url;
}

function removeSavedJob(id) {
  try {
    let saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    saved = saved.filter(j => j.id !== id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    updateSaveButtons(id);
    renderSavedJobs();
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — SEARCH HISTORY (localStorage)
══════════════════════════════════════════════════════════════ */
const SH_KEY = 'jb_searchHistory';
const MAX_SH = 5;

function addToSearchHistory(query) {
  if (!query || query.trim().length < 2) return;
  try {
    let hist = JSON.parse(localStorage.getItem(SH_KEY) || '[]');
    hist = hist.filter(q => q !== query.trim());
    hist.unshift(query.trim());
    if (hist.length > MAX_SH) hist = hist.slice(0, MAX_SH);
    localStorage.setItem(SH_KEY, JSON.stringify(hist));
  } catch {}
}

function showSearchHistory() {
  const drop = document.getElementById('searchHistoryDrop');
  if (!drop) return;
  try {
    const hist = JSON.parse(localStorage.getItem(SH_KEY) || '[]');
    if (hist.length === 0) { drop.classList.remove('show'); return; }
    drop.innerHTML = `<div class="sh-label">Recent searches</div>` +
      hist.map(q => `<button class="sh-item" data-query="${escHtml(q)}">${escHtml(q)}</button>`).join('') +
      `<button class="sh-clear" data-action="clear-history"><i class="bi bi-trash me-1"></i>Clear history</button>`;
    drop.classList.add('show');
  } catch {}
}

window.applyHistorySearch = function(q) {
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = q;
  state.filters.q = q;
  state.page = 1;
  loadJobs();
  toggleClearBtn();
  const drop = document.getElementById('searchHistoryDrop');
  if (drop) drop.classList.remove('show');
};

window.clearSearchHistory = function() {
  localStorage.removeItem(SH_KEY);
  const drop = document.getElementById('searchHistoryDrop');
  if (drop) drop.classList.remove('show');
};

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — WHATSAPP JOB ALERTS
══════════════════════════════════════════════════════════════ */
window.openAlertsModal = function() {
  const el = document.getElementById('alertsModal');
  if (!el) {
    console.warn('[alerts] Modal element #alertsModal not found in page');
    return;
  }
  // getOrCreateInstance prevents duplicate modal instances on repeat clicks
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  // Pre-fill category if one is active
  const catSel = document.getElementById('alertCategorySelect');
  if (catSel && state.filters.category) catSel.value = state.filters.category;
  modal.show();
};

window.submitAlerts = async function() {
  const emailEl   = document.getElementById('alertEmail');
  const category  = document.getElementById('alertCategorySelect')?.value || '';
  const city      = document.getElementById('alertCity')?.value.trim() || '';
  const btn       = document.getElementById('alertSubmitBtn');
  const msgEl     = document.getElementById('alertMsg');

  const email = emailEl?.value.trim().toLowerCase();

  // Validate
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    msgEl.textContent = 'Please enter a valid email address.';
    msgEl.className = 'alert-msg error';
    emailEl?.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Subscribing…';
  msgEl.textContent = '';

  try {
    const res  = await fetch('/api/alerts/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, category, city, channel: 'email' })
    });
    const data = await res.json();

    if (data.success) {
      msgEl.textContent = data.message;
      msgEl.className   = 'alert-msg success';
      btn.innerHTML     = '<i class="bi bi-check-lg me-1"></i>Done!';
      // Store locally so we can show "already subscribed" state later
      localStorage.setItem('jb_alertSub', JSON.stringify({ email, category, city, ts: Date.now() }));
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('alertsModal'))?.hide();
        btn.disabled  = false;
        btn.innerHTML = '<i class="bi bi-envelope-fill me-1"></i>Subscribe';
        msgEl.textContent = '';
        if (emailEl) emailEl.value = '';
      }, 3000);
    } else {
      throw new Error(data.message || 'Failed to subscribe');
    }
  } catch (e) {
    msgEl.textContent = e.message || 'Network error. Please try again.';
    msgEl.className   = 'alert-msg error';
    btn.disabled      = false;
    btn.innerHTML     = '<i class="bi bi-envelope-fill me-1"></i>Subscribe';
  }
};

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — REPORT A JOB
══════════════════════════════════════════════════════════════ */
window.reportJob = async function(jobId, jobTitle, e) {
  if (e) e.stopPropagation();
  const reason = prompt(`Report "${jobTitle}"\n\nSelect reason:\n1. Expired / Filled\n2. Fake or Scam\n3. Inappropriate content\n4. Duplicate listing\n\nEnter number (1-4):`);
  if (!reason) return;
  const reasons = { '1': 'Expired/Filled', '2': 'Fake/Scam', '3': 'Inappropriate', '4': 'Duplicate' };
  const reasonText = reasons[reason.trim()] || 'Other';
  try {
    await fetch('/api/report-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, reason: reasonText })
    });
  } catch {}
  showShareToast('⚑ Report submitted — thank you!');
};

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — SKELETON LOADING
══════════════════════════════════════════════════════════════ */
function showSkeletons(count = 6) {
  const list = $('#jobsList');
  if (!list) return;
  list.className = 'row g-3';
  list.innerHTML = Array(count).fill(0).map(() => `
    <div class="col-md-6 col-lg-6">
      <div class="skeleton-card">
        <div class="skel-line skel-badge"></div>
        <div class="skel-line skel-title"></div>
        <div class="skel-line skel-company"></div>
        <div class="skel-line skel-meta"></div>
        <div class="skel-line skel-desc"></div>
        <div class="skel-line skel-desc short"></div>
        <div class="skel-footer">
          <div class="skel-line skel-date"></div>
          <div class="skel-line skel-btn"></div>
        </div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════════
   PHASE 6 — JOB OF THE DAY
══════════════════════════════════════════════════════════════ */
async function loadJobOfDay() {
  try {
    const data = await cachedGet('/api/jobs/job-of-day', 3600000); // cache 1 hour
    if (!data.success || !data.job) return;
    const job = data.job;
    const section = document.getElementById('jobOfDaySection');
    const card    = document.getElementById('jobOfDayCard');
    if (!section || !card) return;

    const flag = getCityFlag(job.location);
    const salaryHtml = job.salary
      ? `<span><i class="bi bi-cash-stack"></i>${escHtml(job.salary)}</span>` : '';

    card.innerHTML = `
      <div class="jotd-card" onclick="openJobBySlug('${job.slug}')">
        <div style="flex:1;min-width:0">
          <div class="jotd-badge"><i class="bi bi-star-fill me-1"></i>Job of the Day</div>
          <div class="jotd-title">${escHtml(job.title)}</div>
          <div class="jotd-meta">
            <span><i class="bi bi-building"></i>${escHtml(job.company)}</span>
            <span><i class="bi bi-geo-alt"></i>${flag}${escHtml(job.location)}</span>
            <span><i class="bi bi-briefcase"></i>${escHtml(job.job_type || 'Full-time')}</span>
            ${salaryHtml}
            <span><i class="bi bi-clock"></i>${timeAgo(job.created_at)}</span>
          </div>
        </div>
        <button class="jotd-cta" onclick="event.stopPropagation();openJobBySlug('${job.slug}')">
          View Job <i class="bi bi-arrow-right ms-1"></i>
        </button>
      </div>`;
    section.classList.remove('d-none');
  } catch (e) { /* silent — non-critical */ }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 6 — HIRING TRENDS GRAPH
══════════════════════════════════════════════════════════════ */
let trendsChart = null;
let trendsThemeListenerAttached = false;

async function loadHiringTrends() {
  try {
    const data = await cachedGet('/api/jobs/trends', 3600000); // cache 1 hour
    if (!data.success || !data.months) return;

    const section = document.getElementById('hiringTrendsSection');
    if (!section) return;
    section.classList.remove('d-none');

    // ── Monthly chart ────────────────────────────────────────
    const canvas = document.getElementById('hiringTrendsChart');
    if (canvas && typeof Chart !== 'undefined') {
      const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
      const gridCol = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
      const textCol = isDark ? '#94a3b8' : '#64748b';

      if (trendsChart) trendsChart.destroy();
      trendsChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.months.map(m => m.label),
          datasets: [{
            label: 'Jobs Posted',
            data:  data.months.map(m => m.count),
            backgroundColor: 'rgba(15,98,254,.75)',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} jobs posted`
              }
            }
          },
          scales: {
            x: { grid: { color: gridCol }, ticks: { color: textCol } },
            y: { grid: { color: gridCol }, ticks: { color: textCol, precision: 0 }, beginAtZero: true }
          }
        }
      });
    }

    // ── Top categories bar widget ─────────────────────────────
    const topCats = document.getElementById('topCatsWidget');
    if (topCats && data.topCategories?.length) {
      const max = data.topCategories[0].count;
      topCats.innerHTML = data.topCategories.slice(0, 6).map(c => `
        <div class="top-cat-item">
          <span class="top-cat-name">${escHtml(c.name)}</span>
          <div class="top-cat-bar-wrap">
            <div class="top-cat-bar" style="width:${Math.round((c.count/max)*100)}%"></div>
          </div>
          <span class="top-cat-count">${c.count}</span>
        </div>`).join('');
    }

    // Re-render chart on theme toggle (attach only once — prevents listener pile-up)
    if (!trendsThemeListenerAttached) {
      trendsThemeListenerAttached = true;
      document.getElementById('themeToggle')?.addEventListener('click', () => {
        setTimeout(() => loadHiringTrends(), 100);
      });
    }

  } catch (e) { /* silent — non-critical */ }
}

/* ══════════════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════════════ */
function buildPagination(currentPage, totalPages) {
  const ul = $('#pagination');
  ul.innerHTML = '';

  const addItem = (label, page, disabled = false, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
    const a  = document.createElement('a');
    a.className = 'page-link';
    a.href      = '#jobs';
    a.innerHTML = label;
    if (!disabled && !active) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        state.page = page;
        loadJobs();
        document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
      });
    }
    li.appendChild(a);
    ul.appendChild(li);
  };

  addItem('<i class="bi bi-chevron-left"></i>', currentPage - 1, currentPage === 1);
  pagRange(currentPage, totalPages).forEach(p => {
    if (p === '…') addItem('…', null, true);
    else            addItem(p, p, false, p === currentPage);
  });
  addItem('<i class="bi bi-chevron-right"></i>', currentPage + 1, currentPage === totalPages);
}

function pagRange(cur, total) {
  const delta = 2, range = [];
  for (let i = Math.max(2, cur - delta); i <= Math.min(total - 1, cur + delta); i++) range.push(i);
  if (cur - delta > 2)         range.unshift('…');
  if (cur + delta < total - 1) range.push('…');
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
}

/* ══════════════════════════════════════════════════════════════
   FILTER HELPERS
══════════════════════════════════════════════════════════════ */
function toggleClearBtn() {
  const hasFilter = state.filters.q || state.filters.location ||
                    state.filters.category || state.filters.type ||
                    state.filters.salary || state.filters.visa || state.filters.date || state.filters.iqama || state.filters.immediate || state.filters.local ||
                    state.filters.sort !== 'newest';
  const btn = $('#clearFilters');
  btn.classList.toggle('d-none', !hasFilter);
  // Show active filter count
  const count = [state.filters.q, state.filters.location, state.filters.category,
    state.filters.type, state.filters.salary, state.filters.visa, state.filters.date, state.filters.iqama, state.filters.immediate, state.filters.local]
    .filter(Boolean).length;
  const countEl = document.getElementById('filterCount');
  if (countEl) countEl.textContent = count > 0 ? `(${count})` : '';
}

window.resetFilters = function() {
  state.filters = { q: '', location: '', category: '', type: '', sort: 'newest', salary: '', visa: '', date: '', iqama: '', immediate: '', local: '' };
  state.page    = 1;
  $('#searchInput').value    = '';
  $('#locationInput').value  = '';
  $('#categoryFilter').value = '';
  $('#typeFilter').value     = '';
  $('#sortFilter').value     = 'newest';
  const sf = document.getElementById('salaryFilter');
  const vf = document.getElementById('visaFilter');
  const df = document.getElementById('dateFilter');
  if (sf) sf.value = '';
  if (vf) vf.value = '';
  if (df) df.value = '';
  ['iqamaFilter','immediateFilter','localFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active'); });
  toggleClearBtn();
  loadJobs();
};

function setViewMode(mode) {
  state.viewMode = mode;
  if (mode === 'list') {
    $('#jobsList').classList.add('list-view');
    $('#viewList').classList.add('active');
    $('#viewGrid').classList.remove('active');
  } else {
    $('#jobsList').classList.remove('list-view');
    $('#viewGrid').classList.add('active');
    $('#viewList').classList.remove('active');
  }
  loadJobs();
}

let debTimer;
function debounce(fn, ms = 350) {
  clearTimeout(debTimer);
  debTimer = setTimeout(fn, ms);
}

/* ══════════════════════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════════════════════ */
function bindEvents() {
  // Safe null check — navbar may not be in DOM yet on some pages.
  // Shared "themeWired" guard with navbar.html/footer.html — those partials
  // wire this same button too, and without one shared flag the listeners
  // stack up and cancel each other out on an even click count.
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn && !themeBtn.dataset.themeWired) {
    themeBtn.dataset.themeWired = '1';
    themeBtn.addEventListener('click', toggleTheme);
  } else if (!themeBtn) {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      if (!btn.dataset.themeWired) { btn.dataset.themeWired = '1'; btn.addEventListener('click', toggleTheme); }
    });
  }

  // Search history item / clear — event delegation (avoids inline onclick injection)
  document.addEventListener('click', (e) => {
    const shItem = e.target.closest('.sh-item');
    if (shItem && shItem.dataset.query !== undefined) {
      applyHistorySearch(shItem.dataset.query);
      return;
    }
    const shClear = e.target.closest('[data-action="clear-history"]');
    if (shClear) { clearSearchHistory(); return; }
  });

  // Close share dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const drop = document.getElementById('modalShareDropdown');
    const wrap = document.getElementById('modalShareWrap');
    if (drop && drop.classList.contains('open') && wrap && !wrap.contains(e.target)) {
      drop.classList.remove('open');
    }
    // Close search history dropdown
    const shDrop = document.getElementById('searchHistoryDrop');
    const shInp  = document.getElementById('searchInput');
    if (shDrop && shDrop.classList.contains('show') && !shInp?.contains(e.target) && !shDrop.contains(e.target)) {
      shDrop.classList.remove('show');
    }
  });

  // Phase 2: Show search history on input focus
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('focus', () => showSearchHistory());
  }

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.filters.q        = $('#searchInput').value.trim();
    state.filters.location = $('#locationInput').value.trim();
    state.page = 1;
    loadJobs();
    toggleClearBtn();
    if (window.jbTrack) window.jbTrack('search_performed', { query: state.filters.q, has_location: !!state.filters.location });
  });

  $('#searchInput').addEventListener('input', () => {
    debounce(() => { state.filters.q = $('#searchInput').value.trim(); state.page = 1; loadJobs(); toggleClearBtn(); });
  });

  $('#locationInput').addEventListener('input', () => {
    debounce(() => { state.filters.location = $('#locationInput').value.trim(); state.page = 1; loadJobs(); toggleClearBtn(); }, 400);
  });

  $('#categoryFilter').addEventListener('change', (e) => { filterByCategory(e.target.value); });
  $('#typeFilter').addEventListener('change', (e) => { state.filters.type = e.target.value; state.page = 1; loadJobs(); toggleClearBtn(); });
  $('#sortFilter').addEventListener('change', (e) => { state.filters.sort = e.target.value; state.page = 1; loadJobs(); toggleClearBtn(); });
  $('#clearFilters').addEventListener('click', resetFilters);

  // Phase 1 new filters
  const salaryFilter = document.getElementById('salaryFilter');
  const visaFilter   = document.getElementById('visaFilter');
  const dateFilter   = document.getElementById('dateFilter');
  if (salaryFilter) salaryFilter.addEventListener('change', (e) => { state.filters.salary = e.target.value; state.page = 1; loadJobs(); toggleClearBtn(); });
  if (visaFilter)   visaFilter.addEventListener('change',   (e) => { state.filters.visa   = e.target.value; state.page = 1; loadJobs(); toggleClearBtn(); });
  if (dateFilter)   dateFilter.addEventListener('change',   (e) => { state.filters.date   = e.target.value; state.page = 1; loadJobs(); toggleClearBtn(); });
  $('#viewGrid').addEventListener('click', () => setViewMode('grid'));
  $('#viewList').addEventListener('click', () => setViewMode('list'));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.classList.contains('job-card')) {
      openJobModal(document.activeElement.dataset.id);
    }
  });

  $('#footerYear').textContent = new Date().getFullYear();
}

/* ══════════════════════════════════════════════════════════════
   INIT  –  reads URL params so filtered pages work on load
══════════════════════════════════════════════════════════════ */
async function init() {
  // ── Read URL search params for shareable/SEO links ──────────
  const up = new URLSearchParams(window.location.search);
  if (up.get('q'))        state.filters.q        = up.get('q');
  if (up.get('category')) state.filters.category = up.get('category');
  if (up.get('location')) state.filters.location = up.get('location');
  if (up.get('type'))     state.filters.type     = up.get('type');
  if (up.get('sort'))     state.filters.sort     = up.get('sort');
  if (up.get('page'))     state.page             = parseInt(up.get('page')) || 1;

  // Pre-fill visible filter inputs from URL
  if (state.filters.q)        { const el = $('#searchInput');   if (el) el.value = state.filters.q; }
  if (state.filters.location) { const el = $('#locationInput'); if (el) el.value = state.filters.location; }
  if (state.filters.type)     { const el = $('#typeFilter');    if (el) el.value = state.filters.type; }
  if (state.filters.sort)     { const el = $('#sortFilter');    if (el) el.value = state.filters.sort; }

  await loadSettings();

  // Preload form schema for modal extra-field labels
  try {
    const res = await fetch('/api/public/form-schema');
    if (res.ok) { const d = await res.json(); window.__formSchema = d.schema || null; }
  } catch {}

  bindEvents();

  // Run categories + featured in PARALLEL (not sequential)
  await Promise.all([
    loadCategories(),
    loadFeaturedJobs()
  ]);

  // Now load jobs (needs categories ready for filter sync)
  await loadJobs();

  // Non-critical — run after without blocking
  renderRecentlyViewed();
  renderSavedJobs();
  loadJobOfDay();       // Phase 6
  loadHiringTrends();   // Phase 6

  // Populate alerts category dropdown
  const alertCat = document.getElementById('alertCategorySelect');
  if (alertCat && state.categories.length) {
    state.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.name;
      alertCat.appendChild(opt);
    });
  }

  // Fix: Mobile bottom nav active tab
  initMobileNavActive();

}

/* ══════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV — ACTIVE TAB
   Uses IntersectionObserver to highlight the correct tab
   as user scrolls through sections
══════════════════════════════════════════════════════════════ */
function initMobileNavActive() {
  const mbnItems = document.querySelectorAll('.mobile-bottom-nav .mbn-item');
  if (!mbnItems.length) return;

  // Map section IDs to nav item index
  const sectionMap = {
    'jobs':          0,  // Jobs tab
    'featured':      0,  // also Jobs
    'savedJobsWrap': 1,  // Saved tab
  };

  // Set active tab by index
  function setActive(idx) {
    mbnItems.forEach((item, i) => {
      item.classList.toggle('active', i === idx);
    });
  }

  // Click handlers — set active immediately on tap
  mbnItems.forEach((item, idx) => {
    item.addEventListener('click', () => {
      // Don't set active on Alerts button (index 2) or Theme (index 4)
      // Those are actions, not navigation
      if (idx !== 2 && idx !== 4) {
        setActive(idx);
      }
    });
  });

  // IntersectionObserver — auto-update active as user scrolls
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = sectionMap[entry.target.id];
        if (idx !== undefined) setActive(idx);
      }
    });
  }, {
    threshold: 0.3  // section must be 30% visible to trigger
  });

  // Observe the key sections
  ['jobs', 'featured', 'savedJobsWrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  // Set Jobs as default active on load
  setActive(0);
}

document.addEventListener('DOMContentLoaded', init);

function toggleMoreFilters() {
  const extra = document.getElementById('extraFilters');
  const btn = document.getElementById('moreFiltersBtn');
  const isHidden = extra.style.display === 'none' || extra.style.display === '';
  extra.style.display = isHidden ? 'flex' : 'none';
  extra.style.flexWrap = 'wrap';
  extra.style.gap = '.5rem';
  extra.style.marginTop = '.5rem';
  btn.innerHTML = isHidden
    ? '<i class="bi bi-sliders me-1"></i> Less Filters'
    : '<i class="bi bi-sliders me-1"></i> More Filters';
}

function toggleQuickFilter(btn, key) {
  // scroll after slight delay to let jobs load
  const active = btn.classList.toggle('active');
  state.filters[key] = active ? '1' : '';
  state.page = 1;
  loadJobs();
  toggleClearBtn();
}

/* ══════════════════════════════════════════════════════════════
   CANDIDATE APPLICATION FORM
   Logic moved to /js/apply-form.js — shared with the SSR /job/:slug
   page (see server/routes/seo.js). Do not re-add it here.
══════════════════════════════════════════════════════════════ */
