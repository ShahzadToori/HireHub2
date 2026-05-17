'use strict';

/* ════════════════════════════════════════════════════════════
   HIREHUB – JOB.JS
   Handles individual job detail page (/job/[slug])
   Includes: dynamic meta tags, JobPosting schema, breadcrumb
════════════════════════════════════════════════════════════ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);

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

//function waLink(number, jobTitle) {
 // const clean = number.replace(/\D/g, '');
 // const msg   = encodeURIComponent(`Hi, I'm interested in the "${jobTitle}" position.`);
 // return `https://wa.me/${clean}?text=${msg}`;
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
    //`📅 *Posted:* ${postedDate}\n\n` +
    `🔗 *View full job:* ${jobUrl}\n\n` +
    `Hello, I am very interested in this position. Please find my details attached. Thank you.`;

  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── SEO helpers ─────────────────────────────────────────────────
function setMeta(attr, name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}

function injectJobSEO(job, siteUrl, siteName) {
  const canonical  = `${siteUrl}/job/${job.slug}`;
  const datePosted = new Date(job.created_at).toISOString().split('T')[0];
  const metaDesc   = `${job.title} at ${job.company} in ${job.location}. ${job.job_type} · ${job.category}. ${job.description.replace(/\n/g,' ').substring(0, 140)}…`;

  // Page title + canonical
  document.title = `${job.title} at ${job.company} – ${siteName}`;

  let canonEl = document.querySelector('link[rel="canonical"]');
  if (!canonEl) { canonEl = document.createElement('link'); canonEl.rel = 'canonical'; document.head.appendChild(canonEl); }
  canonEl.href = canonical;

  // Meta description
  setMeta('name',     'description',         metaDesc);
  setMeta('name',     'robots',              'index, follow');

  // Open Graph
  setMeta('property', 'og:type',             'article');
  setMeta('property', 'og:title',            `${job.title} at ${job.company}`);
  setMeta('property', 'og:description',      metaDesc);
  setMeta('property', 'og:url',             canonical);
  setMeta('property', 'og:site_name',        siteName);

  // Twitter Card
  setMeta('name', 'twitter:card',             'summary_large_image');
  setMeta('name', 'twitter:title',            `${job.title} at ${job.company}`);
  setMeta('name', 'twitter:description',      metaDesc);

  // ── JobPosting schema ─────────────────────────────────────────
  const empTypeMap = {
    'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME',
    'Contract':  'CONTRACTOR', 'Freelance': 'CONTRACTOR', 'Remote': 'FULL_TIME'
  };

  const jobSchema = {
    '@context':      'https://schema.org',
    '@type':         'JobPosting',
    title:            job.title,
    description:      job.description,
    datePosted:       datePosted,
    validThrough:     new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0],
    employmentType:   empTypeMap[job.job_type] || 'FULL_TIME',
    url:              canonical,
    directApply:      !!(job.phone || job.whatsapp || job.email),
    identifier:       { '@type': 'PropertyValue', name: siteName, value: String(job.id) },
    hiringOrganization: { '@type': 'Organization', name: job.company, sameAs: siteUrl },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type':          'PostalAddress',
        addressLocality:  job.location,
        addressCountry:   'US'
      }
    }
  };

  // Salary from extra_fields
  const extra = job.extra_fields || {};
  if (extra.salary_min || extra.salary_max) {
    jobSchema.baseSalary = {
      '@type': 'MonetaryAmount', currency: 'USD',
      value: {
        '@type': 'QuantitativeValue', unitText: 'YEAR',
        minValue: extra.salary_min || undefined,
        maxValue: extra.salary_max || undefined
      }
    };
  }

  setJsonLd('schema-job', jobSchema);

  // ── BreadcrumbList ────────────────────────────────────────────
  setJsonLd('schema-breadcrumb', {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Jobs',         item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: job.category,   item: `${siteUrl}/?category=${job.category_slug}` },
      { '@type': 'ListItem', position: 3, name: job.title,      item: canonical }
    ]
  });
}

// ── Load settings ────────────────────────────────────────────────
let _siteSettings = {};

async function loadSettings() {
  try {
    const res  = await fetch('/api/settings');
    const data = await res.json();
    _siteSettings = data.settings || {};
    const s = _siteSettings;

    if (s.primary_color)   document.documentElement.style.setProperty('--primary',   s.primary_color);
    if (s.secondary_color) document.documentElement.style.setProperty('--secondary', s.secondary_color);

    if (s.site_name) {
      document.querySelectorAll('.brand-name').forEach(el => el.textContent = s.site_name);
      const fsn = $('#footer-site-name'); if (fsn) fsn.textContent = s.site_name;
      const fcn = $('#footer-copy-name'); if (fcn) fcn.textContent = s.site_name;
    }
    if (s.logo_url) {
      const logo = $('#site-logo');
      if (logo) { logo.src = s.logo_url; logo.classList.remove('d-none'); }
    }
    applyTheme(localStorage.getItem('theme') || s.default_theme || 'light', false);
  } catch (e) {
    console.warn('Settings load failed:', e);
  }
}

function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('theme', theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ── Load job ──────────────────────────────────────────────────────
async function loadJob() {
  const pathParts = window.location.pathname.split('/');
  const slug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

  if (!slug || slug === 'job') { showError('No job specified.'); return; }

  const container = $('#jobDetailContainer');
  container.innerHTML = `<div class="text-center py-5"><div class="spinner-custom"></div><p class="mt-3 text-muted">Loading job details…</p></div>`;

  try {
    const res = await fetch(`/api/jobs/${slug}`);
    if (!res.ok) throw new Error('Job not found');
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Job not found');

    const job      = data.job;
    const siteUrl  = (_siteSettings.site_url || window.location.origin).replace(/\/$/, '');
    const siteName = _siteSettings.site_name || 'HireHub';

    // Inject SEO meta + structured data
    injectJobSEO(job, siteUrl, siteName);

    renderJob(job);
    loadSimilarJobs(job); // Phase 2: non-blocking
  } catch (err) {
    console.error(err);
    showError('Job not found or could not be loaded.');
  }
}

// ── Render job ────────────────────────────────────────────────────
function renderJob(job) {
  const badges = [
    job.sponsored == 1 ? '<span class="badge-sponsored">Sponsored</span>' : '',
    job.featured  == 1 ? '<span class="badge-featured">⭐ Featured</span>' : ''
  ].filter(Boolean).join('');

  const contacts = [
    job.phone    ? `<a href="tel:${job.phone}" class="btn btn-contact btn-phone"><i class="bi bi-telephone-fill me-1"></i>${job.phone}</a>` : '',
    job.whatsapp ? `<a href="${waLink(job)}" class="btn btn-contact btn-whatsapp" target="_blank"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : '',
    job.map_link ? `<a href="${escHtml(job.map_link)}" class="btn btn-contact btn-map" target="_blank"><i class="bi bi-geo-alt-fill me-1"></i>View on Map</a>` : '',
    job.email    ? `<a href="mailto:${job.email}" class="btn btn-contact btn-email"><i class="bi bi-envelope-fill me-1"></i>${job.email}</a>` : ''
  ].filter(Boolean).join(' ');

  // Extra fields
  let extraHtml = '';
  const extra = job.extra_fields;
  if (extra && typeof extra === 'object' && Object.keys(extra).length > 0) {
    let rows = '';
    Object.entries(extra).forEach(([key, val]) => {
      if (!val && val !== 0) return;
      const label      = key.replace(/^fld_\w+_/, '').replace(/_/g, ' ');
      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
      rows += `<div class="extra-field-row">
        <span class="extra-field-label">${escHtml(label)}</span>
        <span class="extra-field-value">${escHtml(displayVal)}</span>
      </div>`;
    });
    if (rows) {
      extraHtml = `<div class="extra-fields-block">
        <div class="modal-desc-label"><i class="bi bi-list-check me-2"></i>Additional Details</div>
        ${rows}
      </div>`;
    }
  }

  const html = `
    <nav aria-label="breadcrumb" style="margin-bottom:1rem">
      <ol class="breadcrumb" style="font-size:.82rem">
        <li class="breadcrumb-item"><a href="/">Jobs</a></li>
        <li class="breadcrumb-item"><a href="/?category=${escHtml(job.category_slug)}">${escHtml(job.category)}</a></li>
        <li class="breadcrumb-item active">${escHtml(job.title)}</li>
      </ol>
    </nav>

    <div class="job-detail-card">
      <div class="job-detail-header">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div class="d-flex flex-wrap gap-1 mb-2">${badges}</div>
            <h1 class="job-detail-title">${escHtml(job.title)}</h1>
            <div class="d-flex flex-wrap gap-2 mt-2">
              <span class="meta-chip"><i class="bi bi-building me-1"></i>${escHtml(job.company)}</span>
              <span class="meta-chip"><i class="bi bi-geo-alt me-1"></i>${escHtml(job.location)}</span>
              <span class="meta-chip"><i class="bi bi-briefcase me-1"></i>${job.job_type || 'Full-time'}</span>
              <span class="meta-chip"><i class="bi bi-tag me-1"></i>${job.category}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="job-detail-body">
        <div class="modal-desc-label"><i class="bi bi-file-text me-2"></i>Job Description</div>
        <div class="job-detail-desc">${escHtml(job.description).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</div>
        ${extraHtml}
      </div>

      <div class="job-detail-footer">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <small class="text-muted"><i class="bi bi-clock me-1"></i>Posted ${timeAgo(job.created_at)}</small>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${contacts}
            <div class="share-wrap" id="jobShareWrap">
              <button class="btn btn-share" id="jobShareBtn" aria-label="Share this job" title="Share job">
                <i class="bi bi-share-fill me-1"></i>Share
              </button>
              <div class="share-dropdown" id="jobShareDropdown" role="menu">
                <a class="share-item share-wa" id="jShareWA" href="#" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Share on WhatsApp</a>
                <a class="share-item share-tg" id="jShareTG" href="#" target="_blank" rel="noopener"><i class="bi bi-telegram"></i> Share on Telegram</a>
                <a class="share-item share-tw" id="jShareTW" href="#" target="_blank" rel="noopener"><i class="bi bi-twitter-x"></i> Share on X</a>
                <a class="share-item share-fb" id="jShareFB" href="#" target="_blank" rel="noopener"><i class="bi bi-facebook"></i> Share on Facebook</a>
                <hr class="share-hr">
                <button class="share-item share-copy" id="jShareCopy"><i class="bi bi-link-45deg"></i> Copy job link</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  $('#jobDetailContainer').innerHTML = html;

  // ── Wire share button ──────────────────────────────────────
  const siteUrl  = (_siteSettings.site_url || window.location.origin).replace(/\/$/, '');
  const jobUrl   = `${siteUrl}/job/${job.slug}`;
  const siteName = _siteSettings.site_name || 'HireHub';
  const shareText = buildShareText(job, jobUrl, siteName);

  const el = (id) => document.getElementById(id);
  if (el('jShareWA'))  el('jShareWA').href  = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  if (el('jShareTG'))  el('jShareTG').href  = `https://t.me/share/url?url=${encodeURIComponent(jobUrl)}&text=${encodeURIComponent(`${job.title} at ${job.company}`)}`;
  if (el('jShareTW'))  el('jShareTW').href  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${job.title} at ${job.company}`)}&url=${encodeURIComponent(jobUrl)}`;
  if (el('jShareFB'))  el('jShareFB').href  = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;

  const shareDrop = el('jobShareDropdown');
  const shareBtn  = el('jobShareBtn');

  if (el('jShareCopy')) {
    el('jShareCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(jobUrl); } catch { fallbackCopy(jobUrl); }
      el('jShareCopy').innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
      el('jShareCopy').classList.add('copied');
      showShareToast('Link copied to clipboard');
      setTimeout(() => {
        el('jShareCopy').innerHTML = '<i class="bi bi-link-45deg"></i> Copy job link';
        el('jShareCopy').classList.remove('copied');
        shareDrop.classList.remove('open');
      }, 1800);
    };
  }

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

  document.addEventListener('click', (e) => {
    const wrap = el('jobShareWrap');
    if (shareDrop && shareDrop.classList.contains('open') && wrap && !wrap.contains(e.target)) {
      shareDrop.classList.remove('open');
    }
  }, { once: false });
}

/* ── Share helpers ────────────────────────────────────────── */
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

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Inject Phase 2 Similar Jobs CSS
  const simCss = document.createElement('style');
  simCss.textContent = `
    .similar-jobs-section{margin-top:2.5rem}
    .sim-heading{font-family:'Syne',sans-serif;font-weight:700;font-size:1rem;color:var(--text-primary);margin-bottom:1rem;padding-bottom:.5rem;border-bottom:2px solid var(--border)}
    .sim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.85rem}
    @media(max-width:480px){.sim-grid{grid-template-columns:1fr}}
    .sim-card{display:block;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;text-decoration:none;transition:transform .18s,border-color .18s,box-shadow .18s}
    .sim-card:hover{transform:translateY(-2px);border-color:var(--primary);box-shadow:0 6px 20px rgba(0,0,0,.08);text-decoration:none}
    .sim-title{font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;color:var(--text-primary);margin-bottom:.25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .sim-company{font-size:.78rem;color:var(--text-muted);margin-bottom:.35rem}
    .sim-meta{display:flex;justify-content:space-between;align-items:center;font-size:.73rem;color:var(--text-muted);margin-bottom:.5rem}
    .sim-time{font-size:.7rem}
    .sim-actions{display:flex;gap:.4rem}
    .sim-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;font-size:.85rem;text-decoration:none;transition:background .15s}
    .sim-wa{background:rgba(37,211,102,.1);color:#25d366}.sim-wa:hover{background:#25d366;color:#fff}
    .sim-ph{background:rgba(15,98,254,.1);color:var(--primary)}.sim-ph:hover{background:var(--primary);color:#fff}
  `;
  document.head.appendChild(simCss);

  await loadSettings();
  $('#themeToggle')?.addEventListener('click', toggleTheme);
  const fy = $('#footerYear'); if (fy) fy.textContent = new Date().getFullYear();
  await loadJob();
});

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — SIMILAR JOBS
══════════════════════════════════════════════════════════════ */
async function loadSimilarJobs(job) {
  try {
    const params = new URLSearchParams({ category: job.category_slug || job.category, limit: 4, sort: 'newest' });
    const res  = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    if (!data.jobs || data.jobs.length === 0) return;

    // Filter out the current job
    const similar = data.jobs.filter(j => j.id !== job.id).slice(0, 4);
    if (similar.length === 0) return;

    const siteUrl = (_siteSettings.site_url || window.location.origin).replace(/\/$/, '');

    const cards = similar.map(j => {
      const wa = j.whatsapp ? `<a href="${waLink(j)}" class="sim-btn sim-wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i></a>` : '';
      const ph = j.phone    ? `<a href="tel:${j.phone}" class="sim-btn sim-ph"><i class="bi bi-telephone-fill"></i></a>` : '';
      return `
        <a href="${siteUrl}/job/${j.slug}" class="sim-card">
          <div class="sim-title">${escHtml(j.title)}</div>
          <div class="sim-company"><i class="bi bi-building me-1"></i>${escHtml(j.company)}</div>
          <div class="sim-meta">
            <span><i class="bi bi-geo-alt me-1"></i>${escHtml(j.location)}</span>
            <span class="sim-time">${timeAgo(j.created_at)}</span>
          </div>
          <div class="sim-actions">${wa}${ph}</div>
        </a>`;
    }).join('');

    const section = document.createElement('div');
    section.className = 'similar-jobs-section';
    section.innerHTML = `
      <div class="sim-heading"><i class="bi bi-briefcase me-2"></i>Similar Jobs</div>
      <div class="sim-grid">${cards}</div>`;

    const container = $('#jobDetailContainer');
    if (container) container.appendChild(section);
  } catch (e) {
    // Silent fail — similar jobs are non-critical
  }
}
