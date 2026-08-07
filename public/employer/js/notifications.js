/* JobOrbit Employer Portal — shared notification bell.
   Aggregates new applications, pending access requests, and expiring jobs
   from GET /api/employer/notifications. Self-contained: wires itself to
   the #epNotifBtn/#epNotifDropdown markup injected into every portal
   page's navbar, so no page-specific script needs to touch it. */
(function () {
  const ICONS = {
    application: { icon: 'bi-person-plus-fill', bg: 'rgba(79,70,229,.1)', color: '#4f46e5' },
    access_request: { icon: 'bi-shield-lock-fill', bg: 'rgba(15,98,254,.1)', color: 'var(--primary)' },
    expiring: { icon: 'bi-hourglass-split', bg: 'rgba(217,119,6,.1)', color: '#d97706' },
  };

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function timeAgo(date) {
    // Expiring-job notifications carry a future timestamp (when the job
    // expires), not a past one — render those as "in Xd" instead of "Xd ago".
    const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    const future = diffSec < 0;
    const diff = Math.abs(diffSec);
    if (diff < 60) return future ? 'soon' : 'just now';
    if (diff < 3600) return future ? `in ${Math.floor(diff / 60)}m` : `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return future ? `in ${Math.floor(diff / 3600)}h` : `${Math.floor(diff / 3600)}h ago`;
    return future ? `in ${Math.floor(diff / 86400)}d` : `${Math.floor(diff / 86400)}d ago`;
  }

  function render(items) {
    const list = document.getElementById('epNotifList');
    const dot = document.getElementById('epNotifDot');
    if (!list) return;
    dot?.classList.toggle('show', items.length > 0);
    if (!items.length) {
      list.innerHTML = '<div class="ep-notif-empty"><i class="bi bi-check2-circle"></i>You\'re all caught up</div>';
      return;
    }
    list.innerHTML = items.map(n => {
      const meta = ICONS[n.type] || ICONS.application;
      return `<div class="ep-notif-item" onclick="window.location.href='${esc(n.link)}'">
        <div class="ep-notif-icon" style="background:${meta.bg};color:${meta.color}"><i class="bi ${meta.icon}"></i></div>
        <div>
          <div class="ep-notif-text">${esc(n.text)}</div>
          <div class="ep-notif-time">${timeAgo(n.time)}</div>
        </div>
      </div>`;
    }).join('');
  }

  async function load() {
    try {
      const r = await fetch('/api/employer/notifications', { credentials: 'include' });
      const d = await r.json();
      if (d.success) render(d.notifications || []);
    } catch (e) { /* silent — bell just won't update this cycle */ }
  }

  function init() {
    const btn = document.getElementById('epNotifBtn');
    const dropdown = document.getElementById('epNotifDropdown');
    const wrap = document.getElementById('epNotifWrap');
    if (!btn || !dropdown || !wrap) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) dropdown.classList.remove('show');
    });

    load();
    setInterval(load, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
