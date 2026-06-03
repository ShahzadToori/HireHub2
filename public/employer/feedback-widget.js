/* ═══════════════════════════════════════════════════════════════
   JobOrbit Employer Feedback Widget
   Drop <script src="/employer/feedback-widget.js"></script> in any
   employer page and it auto-injects the button + modal.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Styles ─────────────────────────────────────────────── */
  const css = `
#fb-btn {
  position: fixed;
  bottom: 80px;
  right: 18px;
  z-index: 1200;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary, #0f62fe);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(15,98,254,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: transform .2s, box-shadow .2s;
}
#fb-btn:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(15,98,254,.5); }
#fb-btn .fb-badge {
  position: absolute;
  top: -3px; right: -3px;
  width: 14px; height: 14px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid #fff;
  animation: fbpulse 2s infinite;
}
@keyframes fbpulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }

#fb-overlay {
  position: fixed; inset: 0; z-index: 1300;
  background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end; justify-content: center;
  opacity: 0; pointer-events: none; transition: opacity .25s;
}
#fb-overlay.show { opacity: 1; pointer-events: all; }

#fb-sheet {
  background: var(--bg-card, #fff);
  border-radius: 20px 20px 0 0;
  width: 100%; max-width: 520px;
  padding: 1.25rem 1.25rem 2rem;
  max-height: 90vh; overflow-y: auto;
  transform: translateY(100%);
  transition: transform .28s cubic-bezier(.32,1,.23,1);
}
#fb-overlay.show #fb-sheet { transform: translateY(0); }

.fb-handle {
  width: 40px; height: 4px;
  background: var(--border, #e5e7eb);
  border-radius: 4px;
  margin: 0 auto 1rem;
}

.fb-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--text-primary, #161616);
  margin-bottom: .25rem;
}
.fb-sub {
  font-size: .8rem;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 1.25rem;
}

/* Stars */
.fb-stars {
  display: flex;
  gap: .35rem;
  justify-content: center;
  margin-bottom: 1.1rem;
}
.fb-star {
  font-size: 2rem;
  cursor: pointer;
  color: var(--border, #e5e7eb);
  transition: color .15s, transform .1s;
  line-height: 1;
  user-select: none;
}
.fb-star.active { color: #f59e0b; }
.fb-star:hover { transform: scale(1.15); }
.fb-rating-label {
  text-align: center;
  font-size: .8rem;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 1rem;
  min-height: 1.2em;
}

/* Categories */
.fb-cats {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  margin-bottom: 1rem;
}
.fb-cat {
  display: flex; align-items: center; gap: .3rem;
  padding: .4rem .75rem;
  border: 1.5px solid var(--border, #e5e7eb);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-family: 'DM Sans', sans-serif;
  font-size: .8rem; font-weight: 500;
  cursor: pointer;
  transition: all .15s;
  min-height: 36px;
}
.fb-cat.active {
  border-color: var(--primary, #0f62fe);
  background: rgba(15,98,254,.08);
  color: var(--primary, #0f62fe);
  font-weight: 600;
}

/* Textarea */
.fb-textarea {
  width: 100%;
  min-height: 90px;
  padding: .65rem .85rem;
  border: 1.5px solid var(--border, #e5e7eb);
  border-radius: 12px;
  background: var(--bg-card, #fff);
  color: var(--text-primary, #161616);
  font-family: 'DM Sans', sans-serif;
  font-size: .85rem;
  resize: vertical;
  box-sizing: border-box;
  width: 100%;
  outline: none;
  transition: border-color .15s;
}
.fb-textarea:focus { border-color: var(--primary, #0f62fe); }
.fb-label {
  display: block;
  font-size: .78rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  margin-bottom: .35rem;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.fb-submit {
  width: 100%;
  padding: .85rem;
  margin-top: .85rem;
  border: none;
  border-radius: 12px;
  background: var(--primary, #0f62fe);
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: .95rem;
  cursor: pointer;
  transition: opacity .15s;
  min-height: 48px;
}
.fb-submit:disabled { opacity: .55; cursor: not-allowed; }

.fb-success {
  text-align: center;
  padding: 1.5rem 0 .5rem;
}
.fb-success-icon { font-size: 3rem; margin-bottom: .5rem; }
.fb-success-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--text-primary, #161616);
  margin-bottom: .35rem;
}
.fb-success-sub { font-size: .85rem; color: var(--text-muted, #9ca3af); }
  `;

  /* ── DOM injection ───────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  document.body.insertAdjacentHTML('beforeend', `
    <button id="fb-btn" title="Share feedback" onclick="fbOpen()">
      <i class="bi bi-chat-heart-fill"></i>
      <span class="fb-badge"></span>
    </button>

    <div id="fb-overlay" onclick="fbOverlayClick(event)">
      <div id="fb-sheet">
        <div class="fb-handle"></div>
        <div id="fb-form-view">
          <div class="fb-title">💬 Share Feedback</div>
          <div class="fb-sub">Help us improve JobOrbit — takes 30 seconds</div>

          <!-- Stars -->
          <div class="fb-stars" id="fbStars">
            <span class="fb-star" onclick="fbSetRating(1)" onmouseover="fbHover(1)" onmouseout="fbHoverOut()">★</span>
            <span class="fb-star" onclick="fbSetRating(2)" onmouseover="fbHover(2)" onmouseout="fbHoverOut()">★</span>
            <span class="fb-star" onclick="fbSetRating(3)" onmouseover="fbHover(3)" onmouseout="fbHoverOut()">★</span>
            <span class="fb-star" onclick="fbSetRating(4)" onmouseover="fbHover(4)" onmouseout="fbHoverOut()">★</span>
            <span class="fb-star" onclick="fbSetRating(5)" onmouseover="fbHover(5)" onmouseout="fbHoverOut()">★</span>
          </div>
          <div class="fb-rating-label" id="fbRatingLabel">Tap to rate your experience</div>

          <!-- Category -->
          <label class="fb-label">Category</label>
          <div class="fb-cats">
            <button class="fb-cat" onclick="fbSetCat('bug',this)">🐛 Bug Report</button>
            <button class="fb-cat" onclick="fbSetCat('feature',this)">✨ Feature Request</button>
            <button class="fb-cat" onclick="fbSetCat('general',this)">💬 General</button>
            <button class="fb-cat" onclick="fbSetCat('other',this)">📝 Other</button>
          </div>

          <!-- Message -->
          <label class="fb-label" for="fbMsg">Your message <span style="color:#ef4444">*</span></label>
          <textarea class="fb-textarea" id="fbMsg" placeholder="Tell us what you think, what's broken, or what you'd love to see..."></textarea>

          <button class="fb-submit" id="fbSubmitBtn" onclick="fbSubmit()">
            <i class="bi bi-send-fill me-2"></i>Send Feedback
          </button>
        </div>

        <div id="fb-success-view" style="display:none">
          <div class="fb-success">
            <div class="fb-success-icon">🎉</div>
            <div class="fb-success-title">Thank you!</div>
            <div class="fb-success-sub">Your feedback helps us build a better JobOrbit.<br>We read every message.</div>
            <button class="fb-submit" onclick="fbClose()" style="margin-top:1.5rem">Close</button>
          </div>
        </div>
      </div>
    </div>
  `);

  /* ── State ───────────────────────────────────────────────── */
  let _rating = 0;
  let _category = '';
  const LABELS = ['', 'Needs work 😞', 'Could be better 😐', 'It\'s okay 🙂', 'Really good 😊', 'Love it! 🤩'];

  /* ── Functions ───────────────────────────────────────────── */
  window.fbOpen = function () {
    _rating = 0; _category = '';
    document.querySelectorAll('.fb-star').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.fb-cat').forEach(c => c.classList.remove('active'));
    document.getElementById('fbMsg').value = '';
    document.getElementById('fbRatingLabel').textContent = 'Tap to rate your experience';
    document.getElementById('fb-form-view').style.display = '';
    document.getElementById('fb-success-view').style.display = 'none';
    document.getElementById('fb-overlay').classList.add('show');
  };

  window.fbClose = function () {
    document.getElementById('fb-overlay').classList.remove('show');
  };

  window.fbOverlayClick = function (e) {
    if (e.target === document.getElementById('fb-overlay')) fbClose();
  };

  window.fbSetRating = function (r) {
    _rating = r;
    fbRenderStars(r);
    document.getElementById('fbRatingLabel').textContent = LABELS[r];
  };

  window.fbHover = function (r) {
    fbRenderStars(r);
  };

  window.fbHoverOut = function () {
    fbRenderStars(_rating);
    document.getElementById('fbRatingLabel').textContent = _rating ? LABELS[_rating] : 'Tap to rate your experience';
  };

  function fbRenderStars(active) {
    document.querySelectorAll('.fb-star').forEach((s, i) => {
      s.classList.toggle('active', i < active);
    });
  }

  window.fbSetCat = function (cat, el) {
    _category = cat;
    document.querySelectorAll('.fb-cat').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  };

  window.fbSubmit = async function () {
    const msg = document.getElementById('fbMsg').value.trim();
    if (!_rating)    { alert('Please select a rating'); return; }
    if (!_category)  { alert('Please select a category'); return; }
    if (!msg)        { alert('Please enter a message'); return; }

    const btn = document.getElementById('fbSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending…';

    try {
      const res = await fetch('/api/employer/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating:    _rating,
          category:  _category,
          message:   msg,
          page_url:  window.location.pathname
        })
      });
      const d = await res.json();
      if (d.success) {
        document.getElementById('fb-form-view').style.display = 'none';
        document.getElementById('fb-success-view').style.display = '';
      } else {
        alert(d.message || 'Failed to send. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Send Feedback';
      }
    } catch (e) {
      alert('Network error. Please try again.');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Send Feedback';
    }
  };
})();
