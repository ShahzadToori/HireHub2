/* ══════════════════════════════════════════════════════════════
   SHARED APPLY FORM LOGIC
   Used by the homepage job-detail modal AND the SSR /job/:slug
   page. Markup lives in partials/apply-form.html, styling in
   css/apply-form.css. Framework-free — do not add a Bootstrap
   dependency here, the SSR page doesn't load Bootstrap.
══════════════════════════════════════════════════════════════ */

window.openApplyForm = async function(jobId, jobTitle) {
  const overlay = document.getElementById('applyOverlay');
  if (!overlay) return;

  // Reset form
  ['applyName','applyPhone','applyWhatsApp','applyEmail','applyNationality','applyNatSearch','applyIqamaNum','applyCoverNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('applyExp').value   = '';
  document.getElementById('applyCert').value  = '0';
  document.getElementById('applyIqama').value = '';
  const cvFileEl = document.getElementById('applyCVFile');
  if (cvFileEl) cvFileEl.value = '';

  const msgEl = document.getElementById('applyMsg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  const subBtn = document.getElementById('applySubmitBtn');
  if (subBtn) { subBtn.disabled = false; subBtn.textContent = 'Submit Application'; }

  const titleEl = document.getElementById('applyJobTitle');
  if (titleEl) titleEl.textContent = jobTitle || '';

  overlay.dataset.jobId = jobId;

  // Load screening questions + show/hide fields the employer enabled
  try {
    const resp = await fetch('/api/employer/screening/' + jobId);
    const data = await resp.json();
    const wrap   = document.getElementById('applyScreeningWrap');
    const fields = document.getElementById('applyScreeningFields');
    if (data.success && data.questions && data.questions.length) {
      fields.innerHTML = data.questions.map((q, i) => `
        <div class="af-field">
          <label class="af-label">${i+1}. ${q.text}</label>
          ${q.type === 'yesno'
            ? `<select class="af-input screening-answer" data-q="${i}"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select>`
            : `<input type="text" class="af-input screening-answer" data-q="${i}" placeholder="Your answer...">`
          }
        </div>`).join('');
      wrap.style.display = '';
    } else {
      wrap.style.display = 'none';
      if (fields) fields.innerHTML = '';
    }

    const fl = data.filters || {};
    const g  = id => document.getElementById(id);
    const sN = !!fl.nationalities, sI = !!fl.iqama_types,
          sE = !!fl.min_experience, sC = !!fl.required_certs;
    if (g('applyColNat'))      g('applyColNat').style.display      = sN ? '' : 'none';
    if (g('applyColIqama'))    g('applyColIqama').style.display    = sI ? '' : 'none';
    if (g('applyColExp'))      g('applyColExp').style.display      = sE ? '' : 'none';
    if (g('applyColCert'))     g('applyColCert').style.display     = sC ? '' : 'none';
    const certLabel = g('applyCertLabel');
    if (certLabel) certLabel.textContent = sC
      ? 'Do you have: ' + fl.required_certs + '?'
      : 'Do you have the required certificate?';
    if (g('applyRowNatIqama')) g('applyRowNatIqama').style.display = (sN||sI) ? '' : 'none';
    if (g('applyRowExpCert'))  g('applyRowExpCert').style.display  = (sE||sC) ? '' : 'none';
    const sIqamaNum = !!fl.require_iqama_number;
    if (g('applyRowIqamaNum')) g('applyRowIqamaNum').style.display = sIqamaNum ? '' : 'none';

    const requireCv = data.require_cv || 0;
    const cvRow   = document.getElementById('applyRowCV');
    const cvLabel = document.getElementById('applyCVLabel');
    if (cvRow) { cvRow.style.display = ''; cvRow.dataset.required = requireCv ? '1' : '0'; }
    if (cvLabel) cvLabel.innerHTML = requireCv
      ? 'CV / Resume (PDF) <span class="af-required">*</span>'
      : 'CV / Resume (PDF) <span class="af-optional">(optional)</span>';
  } catch (e) {
    const wrap = document.getElementById('applyScreeningWrap');
    if (wrap) wrap.style.display = 'none';
    ['applyRowNatIqama','applyRowExpCert','applyRowIqamaNum'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
  }

  // If opened from within the job-detail modal (homepage only), hide it first
  const jobModalEl = document.getElementById('jobModal');
  if (jobModalEl && window.bootstrap) bootstrap.Modal.getInstance(jobModalEl)?.hide();

  overlay.classList.add('open');
};

window.closeApplyForm = function() {
  const overlay = document.getElementById('applyOverlay');
  if (overlay) overlay.classList.remove('open');
};

window.submitApplication = async function() {
  const overlay = document.getElementById('applyOverlay');
  const jobId   = overlay?.dataset.jobId;
  const subBtn  = document.getElementById('applySubmitBtn');

  const name  = document.getElementById('applyName').value.trim();
  const phone = document.getElementById('applyPhone').value.trim();
  const wa    = document.getElementById('applyWhatsApp').value.trim();

  if (!name)         { showApplyMsg('Full name is required', 'error'); return; }
  if (!phone && !wa) { showApplyMsg('Phone or WhatsApp is required', 'error'); return; }

  const email = document.getElementById('applyEmail').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showApplyMsg('Please enter a valid email address', 'error');
    return;
  }

  const screeningAnswers = [];
  document.querySelectorAll('.screening-answer').forEach(el => {
    screeningAnswers.push({ q: parseInt(el.dataset.q), answer: el.value.trim() });
  });

  // CV validation happens before the button is disabled, so a failed
  // check never leaves the button stuck on "Submitting..."
  const cvRow  = document.getElementById('applyRowCV');
  const cvFile = document.getElementById('applyCVFile')?.files?.[0];
  if (cvRow?.dataset.required === '1' && !cvFile) {
    showApplyMsg('Please upload your CV (PDF, max 5MB)', 'error'); return;
  }
  if (cvFile && cvFile.size > 5 * 1024 * 1024) {
    showApplyMsg('CV file too large. Maximum size is 5MB.', 'error'); return;
  }

  subBtn.disabled = true;
  subBtn.textContent = 'Submitting...';

  const fd = new FormData();
  fd.append('full_name',        name);
  fd.append('email',            email || '');
  fd.append('phone',            phone || '');
  fd.append('whatsapp',         wa || '');
  fd.append('nationality',      document.getElementById('applyNationality').value.trim() || '');
  fd.append('iqama_status',     document.getElementById('applyIqama').value || '');
  fd.append('experience_years', document.getElementById('applyExp').value || '');
  fd.append('has_certificate',  document.getElementById('applyCert').value === '1' ? '1' : '0');
  fd.append('iqama_number',     document.getElementById('applyIqamaNum')?.value.trim() || '');
  fd.append('cover_note',       document.getElementById('applyCoverNote').value.trim() || '');
  fd.append('screening_answers', JSON.stringify(screeningAnswers));
  if (cvFile) fd.append('cv', cvFile);

  try {
    const resp   = await fetch('/api/employer/apply/' + jobId, { method: 'POST', body: fd });
    const result = await resp.json();
    if (result.success) {
      showApplyMsg('✅ Application submitted! The employer will contact you.', 'success');
      subBtn.textContent = 'Submitted';
    } else {
      showApplyMsg(result.message || 'Failed to submit. Please try again.', 'error');
      subBtn.disabled = false;
      subBtn.textContent = 'Submit Application';
    }
  } catch (e) {
    showApplyMsg('Network error. Please try again.', 'error');
    subBtn.disabled = false;
    subBtn.textContent = 'Submit Application';
  }
};

function showApplyMsg(text, type) {
  const el = document.getElementById('applyMsg');
  if (!el) return;
  el.className = 'af-msg af-msg-' + type;
  el.textContent = text;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
