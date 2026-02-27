'use strict';

// ── DOM helpers ────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);

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

// ── Load settings (same as main.js) ───────────────────────────
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings;

    if (s.primary_color) {
      document.documentElement.style.setProperty('--primary', s.primary_color);
      document.documentElement.style.setProperty('--primary-hover', s.primary_color.replace('#', '#') + 'cc');
    }
    if (s.secondary_color) {
      document.documentElement.style.setProperty('--secondary', s.secondary_color);
    }
    if (s.site_name) {
      document.querySelectorAll('.brand-name').forEach(el => el.textContent = s.site_name);
      $('#footer-site-name').textContent = s.site_name;
      $('#footer-copy-name').textContent = s.site_name;
      document.title = `${s.site_name} – Job Details`;
    }
    if (s.logo_url) {
      const logo = $('#site-logo');
      logo.src = s.logo_url;
      logo.classList.remove('d-none');
    }
    const savedTheme = localStorage.getItem('theme') || s.default_theme || 'light';
    applyTheme(savedTheme, false);
  } catch (e) {
    console.warn('Settings load failed:', e);
  }
}

// ── Theme Toggle (same as main.js) ────────────────────────────
function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Escape HTML (for security) ────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Load job details ──────────────────────────────────────────
async function loadJob() {
  // Extract slug from URL path (e.g., /job/senior-developer)
  const path = window.location.pathname;
  const slug = path.replace('/job/', '').replace(/\/$/, ''); // remove leading and trailing slashes
  if (!slug) {
    showError('No job specified.');
    return;
  }

  const container = $('#jobDetailContainer');
  container.innerHTML = `<div class="text-center py-5"><div class="spinner-custom"></div><p class="mt-3 text-muted">Loading job details…</p></div>`;

  try {
    const res = await fetch(`/api/jobs/${slug}`);
    if (!res.ok) throw new Error('Job not found');
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Job not found');
    const job = data.job;
    renderJob(job);
    document.title = `${job.title} at ${job.company} | ${document.title.split('|')[1] || 'HireHub'}`;
  } catch (err) {
    console.error(err);
    showError('Job not found or could not be loaded.');
  }
}

// ── Render job details (adapted from modal code) ──────────────
function renderJob(job) {
  const badges = [
    job.sponsored == 1 ? '<span class="badge-sponsored">Sponsored</span>' : '',
    job.featured  == 1 ? '<span class="badge-featured">⭐ Featured</span>' : ''
  ].filter(Boolean).join('');

  const contacts = [
    job.phone    ? `<a href="tel:${job.phone}" class="btn btn-contact btn-phone"><i class="bi bi-telephone-fill me-1"></i>${job.phone}</a>` : '',
    job.whatsapp ? `<a href="${waLink(job.whatsapp, job.title)}" class="btn btn-contact btn-whatsapp" target="_blank"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : '',
    job.map_link ? `<a href="${escHtml(job.map_link)}" class="btn btn-contact btn-map" target="_blank"><i class="bi bi-geo-alt-fill me-1"></i>View on Map</a>` : '',
    job.email    ? `<a href="mailto:${job.email}" class="btn btn-contact btn-email"><i class="bi bi-envelope-fill me-1"></i>${job.email}</a>` : ''
  ].filter(Boolean).join(' ');

  // Parse extra_fields if present
  let extraHtml = '';
  if (job.extra_fields && typeof job.extra_fields === 'object' && Object.keys(job.extra_fields).length > 0) {
    let rows = '';
    Object.entries(job.extra_fields).forEach(([key, val]) => {
      if (!val && val !== 0) return;
      const label = key.replace(/^fld_\w+_/, '').replace(/_/g, ' ');
      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
      rows += `<div class="extra-field-row"><span class="extra-field-label">${escHtml(label)}</span><span class="extra-field-value">${escHtml(displayVal)}</span></div>`;
    });
    if (rows) {
      extraHtml = `<div class="extra-fields-block"><div class="modal-desc-label"><i class="bi bi-list-check me-2"></i>Additional Details</div>${rows}</div>`;
    }
  }

  const html = `
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
        <div class="job-detail-desc">${escHtml(job.description).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>
        ${extraHtml}
      </div>

      <div class="job-detail-footer">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <small class="text-muted"><i class="bi bi-clock me-1"></i>Posted ${timeAgo(job.created_at)}</small>
          <div class="d-flex flex-wrap gap-2">
            ${contacts}
          </div>
        </div>
      </div>
    </div>
  `;

  $('#jobDetailContainer').innerHTML = html;
}

function showError(msg) {
  $('#jobDetailContainer').innerHTML = `
    <div class="text-center py-5">
      <i class="bi bi-exclamation-triangle fs-1 text-muted"></i>
      <h4 class="mt-3">${msg}</h4>
      <a href="/" class="btn btn-primary mt-3">Back to Home</a>
    </div>
  `;
}

// ── Initialize ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  $('#themeToggle')?.addEventListener('click', toggleTheme);
  $('#footerYear').textContent = new Date().getFullYear();
  loadJob();
});