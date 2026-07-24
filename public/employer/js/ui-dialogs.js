/* JobOrbit Employer Portal — shared confirm/alert dialogs.
   Replaces native window.confirm()/alert() with a styled modal that
   matches the portal's design system (uses the same --primary/--bg-card/
   --border CSS vars as employer.css, so no extra include is needed). */
(function () {
  let overlay, titleEl, msgEl, okBtn, cancelBtn, resolver;

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'uiDialogOverlay';
    overlay.innerHTML = `
      <div class="ui-dialog-box" role="alertdialog" aria-modal="true">
        <h3 class="ui-dialog-title"></h3>
        <p class="ui-dialog-msg"></p>
        <div class="ui-dialog-actions">
          <button type="button" class="ui-dialog-btn ui-dialog-cancel"></button>
          <button type="button" class="ui-dialog-btn ui-dialog-ok"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const style = document.createElement('style');
    style.textContent = `
      #uiDialogOverlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);padding:1rem}
      #uiDialogOverlay.show{display:flex}
      .ui-dialog-box{background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);max-width:400px;width:100%;padding:1.5rem;font-family:'Source Sans 3',sans-serif;animation:uiDialogPop .16s ease}
      @keyframes uiDialogPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
      .ui-dialog-title{font-family:'Lexend',sans-serif;font-weight:700;font-size:1.05rem;color:var(--text-primary,#111827);margin:0 0 .5rem}
      .ui-dialog-msg{font-size:.88rem;color:var(--text-secondary,#6b7280);margin:0 0 1.25rem;line-height:1.5;white-space:pre-line}
      .ui-dialog-actions{display:flex;gap:.6rem;justify-content:flex-end}
      .ui-dialog-btn{border:none;border-radius:10px;padding:.55rem 1.1rem;font-size:.85rem;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s}
      .ui-dialog-btn:active{transform:scale(.97)}
      .ui-dialog-cancel{background:var(--bg-body,#f3f4f6);color:var(--text-secondary,#6b7280);border:1.5px solid var(--border,#e5e7eb)}
      .ui-dialog-cancel:hover{border-color:var(--primary,#0f62fe);color:var(--primary,#0f62fe)}
      .ui-dialog-ok{background:var(--primary,#0f62fe);color:#fff}
      .ui-dialog-ok:hover{opacity:.9}
      .ui-dialog-ok.danger{background:#dc2626}
      @media(max-width:480px){.ui-dialog-box{padding:1.25rem}}
    `;
    document.head.appendChild(style);

    okBtn = overlay.querySelector('.ui-dialog-ok');
    cancelBtn = overlay.querySelector('.ui-dialog-cancel');
    titleEl = overlay.querySelector('.ui-dialog-title');
    msgEl = overlay.querySelector('.ui-dialog-msg');

    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('show')) return;
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    });
  }

  function close(result) {
    overlay.classList.remove('show');
    if (resolver) { resolver(result); resolver = null; }
  }

  window.showConfirm = function (message, opts = {}) {
    ensureDom();
    titleEl.textContent = opts.title || 'Please confirm';
    msgEl.textContent = message;
    okBtn.textContent = opts.confirmText || 'Confirm';
    cancelBtn.textContent = opts.cancelText || 'Cancel';
    cancelBtn.style.display = '';
    okBtn.classList.toggle('danger', !!opts.danger);
    overlay.classList.add('show');
    return new Promise((resolve) => { resolver = resolve; okBtn.focus(); });
  };

  window.showAlert = function (message, opts = {}) {
    ensureDom();
    titleEl.textContent = opts.title || (opts.type === 'error' ? 'Something went wrong' : 'Notice');
    msgEl.textContent = message;
    okBtn.textContent = opts.okText || 'OK';
    okBtn.classList.toggle('danger', opts.type === 'error');
    cancelBtn.style.display = 'none';
    overlay.classList.add('show');
    return new Promise((resolve) => { resolver = () => resolve(); okBtn.focus(); });
  };
})();
