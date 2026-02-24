/* ════════════════════════════════════════════════════════════
   HIREHUB – MAIN.JS
   Handles: settings, theme, jobs, filters, modal, pagination
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
  viewMode:     'grid',   // 'grid' | 'list'
  filters: {
    q:        '',
    location: '',
    category: '',
    type:     '',
    sort:     'newest'
  }
};

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
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

// ── WhatsApp link builder ──────────────────────────────────────
function waLink(number, jobTitle) {
  const clean = number.replace(/\D/g, '');
  const msg   = encodeURIComponent(`Hi, I'm interested in the "${jobTitle}" position.`);
  return `https://wa.me/${clean}?text=${msg}`;
}

// ── Settings ───────────────────────────────────────────────────
async function loadSettings() {
  try {
    const data = await api.get('/api/settings');
    state.settings = data.settings;

    const s = state.settings;

    // Apply primary color
    if (s.primary_color) {
      document.documentElement.style.setProperty('--primary', s.primary_color);
      document.documentElement.style.setProperty('--primary-hover',
        s.primary_color.replace('#', '#') + 'cc');  // approx
    }
    if (s.secondary_color) {
      document.documentElement.style.setProperty('--secondary', s.secondary_color);
    }

    // Apply text
    if (s.site_name) {
      document.title = `${s.site_name} – Find Your Next Career Opportunity`;
      $$('.brand-name').forEach(el => { el.textContent = s.site_name; });
      $('#footer-site-name').textContent  = s.site_name;
      $('#footer-copy-name').textContent  = s.site_name;
    }
    if (s.hero_title)    $('#hero-title').textContent    = s.hero_title;
    if (s.hero_subtitle) $('#hero-subtitle').textContent = s.hero_subtitle;

    // Logo
    if (s.logo_url) {
      const logo = $('#site-logo');
      logo.src = s.logo_url;
      logo.classList.remove('d-none');
    }

    // Default theme
    const savedTheme = localStorage.getItem('theme') || s.default_theme || 'light';
    applyTheme(savedTheme, false);

    // Ads
    if (s.show_banner_top === '1') {
      $('#ad-top').classList.remove('d-none');
    }
    if (s.show_banner_side === '1') {
      $('#ad-sidebar').classList.remove('d-none');
    }
  } catch (e) {
    console.warn('Settings load failed:', e);
  }
}

// ── Theme Toggle ───────────────────────────────────────────────
function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon');
  icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Categories ─────────────────────────────────────────────────
async function loadCategories() {
  try {
    const data = await api.get('/api/jobs/categories');
    state.categories = data.categories;

    // Populate filter dropdown
    const catFilter = $('#categoryFilter');
    state.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = `${c.name} (${c.count})`;
      catFilter.appendChild(opt);
    });

    // Stat
    $('#stat-cats').textContent = state.categories.length;

    // Chips
    const chipsContainer = $('#categoryChips');
    chipsContainer.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'category-chip active';
    allChip.innerHTML = `<i class="bi bi-grid"></i> All <span class="cat-count">${state.categories.reduce((a,c)=>a+c.count,0)}</span>`;
    allChip.addEventListener('click', () => filterByCategory(''));
    chipsContainer.appendChild(allChip);

    state.categories.forEach(c => {
      const chip = document.createElement('button');
      chip.className  = 'category-chip';
      chip.dataset.slug = c.slug;
      chip.innerHTML  = `${c.name} <span class="cat-count">${c.count}</span>`;
      chip.addEventListener('click', () => filterByCategory(c.slug));
      chipsContainer.appendChild(chip);
    });

    // Sidebar category list
    const sidebarCats = $('#sidebarCats');
    state.categories.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${c.name}</span><span class="cat-badge">${c.count}</span>`;
      li.addEventListener('click', () => filterByCategory(c.slug));
      sidebarCats.appendChild(li);
    });
  } catch (e) {
    console.warn('Categories load failed:', e);
  }
}

function filterByCategory(slug) {
  state.filters.category = slug;
  state.page = 1;

  // Update chips UI
  $$('.category-chip').forEach(chip => {
    chip.classList.toggle('active',
      slug === '' ? !chip.dataset.slug : chip.dataset.slug === slug
    );
  });

  // Update select
  $('#categoryFilter').value = slug;

  loadJobs();
  toggleClearBtn();
}

// ── Featured Jobs ──────────────────────────────────────────────
async function loadFeaturedJobs() {
  try {
    const data = await api.get('/api/jobs/featured');
    const container = $('#featuredList');

    if (!data.jobs || data.jobs.length === 0) {
      $('#featured').classList.add('d-none');
      return;
    }

    container.innerHTML = data.jobs.map(job => `
      <div class="col-md-6 col-lg-4">
        ${renderJobCard(job, true)}
      </div>
    `).join('');

    // Add featured jobs to cache
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

// ── Load Jobs ──────────────────────────────────────────────────
async function loadJobs() {
  const spinner    = $('#loadingSpinner');
  const list       = $('#jobsList');
  const emptyState = $('#emptyState');
  const pagination = $('#paginationWrap');
  const resultsInfo = $('#resultsInfo');

  spinner.classList.remove('d-none');
  list.innerHTML  = '';
  emptyState.classList.add('d-none');
  pagination.classList.add('d-none');

  try {
    const params = new URLSearchParams({
      q:        state.filters.q,
      location: state.filters.location,
      category: state.filters.category,
      type:     state.filters.type,
      sort:     state.filters.sort,
      page:     state.page,
      limit:    state.settings.jobs_per_page || 12
    });

    // Remove empty params
    [...params.keys()].forEach(k => { if (!params.get(k)) params.delete(k); });

    const data = await api.get(`/api/jobs?${params}`);

    spinner.classList.add('d-none');

    state.totalJobs  = data.total;
    state.totalPages = data.pages;

    $('#stat-total').textContent = data.total;

    if (data.jobs.length === 0) {
      emptyState.classList.remove('d-none');
      resultsInfo.textContent = 'No jobs found';
      return;
    }

    resultsInfo.textContent = `Showing ${data.jobs.length} of ${data.total} jobs`;

    // Store jobs in state cache so modal can look them up by id
    state.jobs = data.jobs;

    list.className = state.viewMode === 'list' ? 'row g-3 list-view' : 'row g-3';

    list.innerHTML = data.jobs.map((job, idx) => {
      // Insert ad every 6 jobs
      const adInsert = (idx === 5 && state.page === 1)
        ? '<div class="col-12" id="ad-between"><span class="ad-label text-muted small d-block text-center">Advertisement</span></div>'
        : '';
      return `${adInsert}<div class="col-md-6 col-lg-${state.viewMode === 'list' ? '12' : '6'}">${renderJobCard(job)}</div>`;
    }).join('');

    list.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('a')) openJobModal(card.dataset.id);
      });
    });

    // Schema injection
    updateSchema(data.jobs);

    // Pagination
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

// ── Render Job Card HTML ───────────────────────────────────────
function renderJobCard(job, isFeaturedSection = false) {
  const isFeatured  = job.featured == 1;
  const isSponsored = job.sponsored == 1;

  let cardClass = 'job-card';
  if (isFeatured)  cardClass += ' featured-card';
  if (isSponsored) cardClass += ' sponsored-card';

  const badges = [
    isSponsored ? '<span class="badge-sponsored">Sponsored</span>' : '',
    isFeatured  ? '<span class="badge-featured">⭐ Featured</span>' : '',
    `<span class="badge-category">${job.category}</span>`,
    `<span class="badge-type">${job.job_type || 'Full-time'}</span>`
  ].filter(Boolean).join('');

  const contacts = [
    job.phone    ? `<a href="tel:${job.phone}" class="btn-contact-icon phone" title="Call" onclick="event.stopPropagation()"><i class="bi bi-telephone-fill"></i></a>` : '',
    job.whatsapp ? `<a href="${waLink(job.whatsapp, job.title)}" class="btn-contact-icon whatsapp" title="WhatsApp" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="bi bi-whatsapp"></i></a>` : '',
    job.email    ? `<a href="mailto:${job.email}" class="btn-contact-icon email" title="Email" onclick="event.stopPropagation()"><i class="bi bi-envelope-fill"></i></a>` : ''
  ].filter(Boolean).join('');

  return `
    <div class="${cardClass}" data-id="${job.id}" data-slug="${job.slug || ''}" role="button" tabindex="0"
         aria-label="View ${job.title} at ${job.company}">
      <div class="card-badges">${badges}</div>
      <div class="card-title">${escHtml(job.title)}</div>
      <div class="card-company"><i class="bi bi-building me-1"></i>${escHtml(job.company)}</div>
      <div class="card-meta">
        <span class="meta-item"><i class="bi bi-geo-alt"></i>${escHtml(job.location)}</span>
      </div>
      <p class="card-desc">${escHtml(job.description)}</p>
      <div class="card-footer-row">
        <span class="card-date"><i class="bi bi-clock me-1"></i>${timeAgo(job.created_at)}</span>
        <div class="card-contacts">${contacts}</div>
      </div>
    </div>`;
}

// ── Job Modal ──────────────────────────────────────────────────
async function openJobModal(jobId) {
  // First try from state cache (already loaded, instant)
  const cached = state.jobs.find(j => j.id == jobId);
  if (cached) {
    populateModal(cached);
    const modal = new bootstrap.Modal($('#jobModal'));
    modal.show();
    return;
  }

  // Fallback: fetch by slug if we have it, otherwise show loading state
  try {
    // Find slug from any rendered card
    const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
    const slug = card ? card.dataset.slug : null;
    if (!slug) return;

    const data = await api.get(`/api/jobs/${slug}`);
    if (!data.success) return;
    // Store in cache
    state.jobs.push(data.job);
    populateModal(data.job);
    new bootstrap.Modal($('#jobModal')).show();
  } catch (e) {
    console.warn('Could not load job details:', e);
  }
}

function populateModal(job) {
  const badges = [
    job.sponsored == 1 ? '<span class="badge-sponsored">Sponsored</span>' : '',
    job.featured  == 1 ? '<span class="badge-featured">⭐ Featured</span>' : ''
  ].filter(Boolean).join('');

  $('#modalBadges').innerHTML    = badges;
  $('#modalTitle').textContent   = job.title;
  $('#modalCompany').textContent = job.company;
  $('#modalLocation').textContent = job.location;
  $('#modalType').textContent    = job.job_type || 'Full-time';
  $('#modalCategory').textContent = job.category;
  $('#modalPosted').textContent  = `Posted ${timeAgo(job.created_at)}`;

  // Render description: convert newlines to <br> and escape HTML
  const descEl = $('#modalDescription');
  descEl.innerHTML = escHtml(job.description)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  // Wrap in paragraphs if not already
  if (!descEl.innerHTML.startsWith('<p>')) {
    descEl.innerHTML = '<p>' + descEl.innerHTML + '</p>';
  }

  const phone    = $('#modalPhone');
  const whatsapp = $('#modalWhatsApp');
  const email    = $('#modalEmail');

  if (job.phone) {
    phone.href = `tel:${job.phone}`;
    phone.textContent = '';
    phone.innerHTML = `<i class="bi bi-telephone-fill me-1"></i>${job.phone}`;
    phone.classList.remove('d-none');
  } else {
    phone.classList.add('d-none');
  }

  if (job.whatsapp) {
    whatsapp.href = waLink(job.whatsapp, job.title);
    whatsapp.innerHTML = `<i class="bi bi-whatsapp me-1"></i>WhatsApp`;
    whatsapp.classList.remove('d-none');
  } else {
    whatsapp.classList.add('d-none');
  }

  if (job.email) {
    email.href = `mailto:${job.email}`;
    email.innerHTML = `<i class="bi bi-envelope-fill me-1"></i>${job.email}`;
    email.classList.remove('d-none');
  } else {
    email.classList.add('d-none');
  }

  // Update page title for SEO context
  document.title = `${job.title} at ${job.company} | ${state.settings.site_name || 'HireHub'}`;
}

// ── Pagination ─────────────────────────────────────────────────
function buildPagination(currentPage, totalPages) {
  const ul = $('#pagination');
  ul.innerHTML = '';

  const addItem = (label, page, disabled = false, active = false) => {
    const li  = document.createElement('li');
    li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
    const a   = document.createElement('a');
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

  const range = pagRange(currentPage, totalPages);
  range.forEach(p => {
    if (p === '…') {
      addItem('…', null, true);
    } else {
      addItem(p, p, false, p === currentPage);
    }
  });

  addItem('<i class="bi bi-chevron-right"></i>', currentPage + 1, currentPage === totalPages);
}

function pagRange(cur, total) {
  const delta = 2;
  const range = [];
  for (let i = Math.max(2, cur - delta); i <= Math.min(total - 1, cur + delta); i++) {
    range.push(i);
  }
  if (cur - delta > 2) range.unshift('…');
  if (cur + delta < total - 1) range.push('…');
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
}

// ── Schema Markup ──────────────────────────────────────────────
function updateSchema(jobs) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": jobs.map((job, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "JobPosting",
        "title": job.title,
        "hiringOrganization": { "@type": "Organization", "name": job.company },
        "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": job.location } },
        "description": job.description.substring(0, 200),
        "datePosted": new Date(job.created_at).toISOString().split('T')[0],
        "employmentType": job.job_type || 'FULL_TIME'
      }
    }))
  };
  $('#schema-list').textContent = JSON.stringify(schema);
}

// ── Filter handlers ────────────────────────────────────────────
function toggleClearBtn() {
  const hasFilter = state.filters.q || state.filters.location ||
                    state.filters.category || state.filters.type ||
                    state.filters.sort !== 'newest';
  $('#clearFilters').classList.toggle('d-none', !hasFilter);
}

window.resetFilters = function() {
  state.filters = { q: '', location: '', category: '', type: '', sort: 'newest' };
  state.page    = 1;
  $('#searchInput').value   = '';
  $('#locationInput').value = '';
  $('#categoryFilter').value = '';
  $('#typeFilter').value     = '';
  $('#sortFilter').value     = 'newest';
  $$('.category-chip').forEach(c => c.classList.remove('active'));
  $$('.category-chip')[0]?.classList.add('active');
  toggleClearBtn();
  loadJobs();
};

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

// ── View mode toggle ───────────────────────────────────────────
function setViewMode(mode) {
  state.viewMode = mode;
  const grid = $('#jobsList');
  if (mode === 'list') {
    grid.classList.add('list-view');
    $('#viewList').classList.add('active');
    $('#viewGrid').classList.remove('active');
  } else {
    grid.classList.remove('list-view');
    $('#viewGrid').classList.add('active');
    $('#viewList').classList.remove('active');
  }
  loadJobs();
}

// ── Search debounce ────────────────────────────────────────────
let debTimer;
function debounce(fn, ms = 350) {
  clearTimeout(debTimer);
  debTimer = setTimeout(fn, ms);
}

// ── Event Listeners ────────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  $('#themeToggle').addEventListener('click', toggleTheme);

  // Search form submit
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.filters.q        = $('#searchInput').value.trim();
    state.filters.location = $('#locationInput').value.trim();
    state.page = 1;
    loadJobs();
    toggleClearBtn();
  });

  // Keyword input – live search
  $('#searchInput').addEventListener('input', () => {
    debounce(() => {
      state.filters.q = $('#searchInput').value.trim();
      state.page = 1;
      loadJobs();
      toggleClearBtn();
    });
  });

  // Location input – live search
  $('#locationInput').addEventListener('input', () => {
    debounce(() => {
      state.filters.location = $('#locationInput').value.trim();
      state.page = 1;
      loadJobs();
      toggleClearBtn();
    }, 400);
  });

  // Category filter dropdown
  $('#categoryFilter').addEventListener('change', (e) => {
    filterByCategory(e.target.value);
  });

  // Type filter
  $('#typeFilter').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    state.page = 1;
    loadJobs();
    toggleClearBtn();
  });

  // Sort filter
  $('#sortFilter').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    state.page = 1;
    loadJobs();
    toggleClearBtn();
  });

  // Clear filters
  $('#clearFilters').addEventListener('click', resetFilters);

  // View toggles
  $('#viewGrid').addEventListener('click', () => setViewMode('grid'));
  $('#viewList').addEventListener('click', () => setViewMode('list'));

  // Keyboard support for job cards
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.classList.contains('job-card')) {
      openJobModal(document.activeElement.dataset.id);
    }
  });

  // Footer year
  $('#footerYear').textContent = new Date().getFullYear();
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  await loadSettings();
  bindEvents();
  await loadCategories();
  await loadFeaturedJobs();
  await loadJobs();
}

document.addEventListener('DOMContentLoaded', init);
