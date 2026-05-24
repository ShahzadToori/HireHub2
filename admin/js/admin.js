/* ════════════════════════════════════════════════════════════
   HIREHUB – ADMIN.JS  (shared across all admin pages)
════════════════════════════════════════════════════════════ */

'use strict';

// ── Auth guard ──────────────────────────────────────────────────
async function requireAuth() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = '/admin/index.html';
      return;
    }
    window._adminPermissions = data.permissions || [];
    window._adminRole = data.role || 'super_admin';
    const nameEl = document.getElementById('adminName');
    if (nameEl) {
      nameEl.textContent = (data.username || 'A')[0].toUpperCase();
      nameEl.title       = data.username;
    }
  } catch {
    window.location.href = '/admin/index.html';
  }
}

// ── API helper ──────────────────────────────────────────────────
const adminApi = {
  get: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  post: async (url, body) => {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    return res.json();
  },
  put: async (url, body) => {
    const res = await fetch(url, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    return res.json();
  },
  del: async (url, body = null) => {
    const opts = { method: 'DELETE' };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body    = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    return res.json();
  },
  patch: async (url, body = null) => {
    const opts = { method: "PATCH" };
    if (body) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    const res = await fetch(url, opts);
    return res.json();
  },
};

// ── HTML escape ─────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Time ago ────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

// ── Theme toggle ────────────────────────────────────────────────
function applyAdminTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('adminThemeIcon');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('adminTheme', theme);
}

// ── Sidebar toggle (mobile) ─────────────────────────────────────
async function initSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const toggleBtn = document.getElementById('sidebarToggle');
  const closeBtn  = document.getElementById('sidebarClose');

  function openSidebar()  { sidebar?.classList.add('open');    overlay?.classList.remove('d-none'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.add('d-none'); }
  toggleBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Fetch menu from DB
  try {
    const res  = await fetch('/api/admin-menu');
    const data = await res.json();
    if (!data.success || !data.menu) return;

    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const nav = sidebar?.querySelector('.sidebar-nav');
    if (!nav) return;

    // Check if current page is allowed
    const allowed = data.menu.find(m => m.href === currentPage);
    const role = window._adminRole || '';
    if (!allowed && role !== 'super_admin') {
      const first = data.menu[0];
      if (first) { window.location.href = first.href; return; }
    }

    // Remove existing hardcoded links (keep divider + bottom links)
    nav.querySelectorAll('a.sidebar-link').forEach(el => {
      if (!el.getAttribute('target')) el.remove();
    });

    // Build menu from DB
    const divider = nav.querySelector('.sidebar-divider');
    data.menu.forEach(item => {
      const a = document.createElement('a');
      a.href = item.href;
      a.className = 'sidebar-link' + (item.href === currentPage ? ' active' : '');
      a.innerHTML = '<i class="bi ' + item.icon + '"></i><span>' + item.label + '</span>';
      if (divider) nav.insertBefore(a, divider);
      else nav.appendChild(a);
    });
  } catch(e) { console.warn('Menu load failed', e.message); }
}

// ── Logout ──────────────────────────────────────────────────────
function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/index.html';
  });
}

// ── Edit job shortcut ────────────────────────────────────────────
// edit-job.html just points to add-job.html?id=X (reuse same form)
// This redirect is handled in add-job.html

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  const savedTheme = localStorage.getItem('adminTheme') || 'light';
  applyAdminTheme(savedTheme, false);

  // Theme toggle
  document.getElementById('themeToggleAdmin')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyAdminTheme(cur === 'dark' ? 'light' : 'dark');
  });

  initSidebar();
  initLogout();
});
