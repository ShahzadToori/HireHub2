/* ═══════════════════════════════════════════════════════════════
   JobOrbit Gulf Resume Builder — Complete JavaScript
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. DATA MODEL — Single source of truth
══════════════════════════════════════════════════════════════ */
const RB = {
  data: {
    personal: {
      fullNameEn:'', fullNameAr:'', photo: null, photoDataUrl: '',
      jobTitle:'', dob:'', nationality:'', religion:'',
      maritalStatus:'', gender:'', currentCity:'', currentCountry:'',
      passportNumber:'', passportExpiry:'', visaStatus:'',
      iqamaNumber:'', transferableIqama: false,
      noticePeriod:'', expectedSalary:'', salaryCurrency:'SAR',
      willingToRelocate: false, relocateCities:'',
      drivingLicense: false, saudiLicense: false,
      phone:'', phoneCode:'+966', whatsapp:'', waCode:'+966',
      email:'', linkedin:'', currentEmployer:''
    },
    summary: { text: '' },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    references: [],
    achievements: '',
    customSections: [],
    settings: { template: 'classic', accentColor: '#0D1B2A', font: 'dm-sans', fontSize: 'regular' }
  },
  currentStep: 1,
  totalSteps: 6,
  autosaveKey: 'rb_joborbit_data',
  autosaveTimer: null
};

/* ══════════════════════════════════════════════════════════════
   2. SALARY BENCHMARK DATA (Gulf market)
══════════════════════════════════════════════════════════════ */
const SALARY_MAP = {
  'software engineer':        [10000,22000], 'software developer':     [10000,22000],
  'senior software engineer': [18000,35000], 'frontend developer':      [8000,18000],
  'backend developer':        [10000,22000], 'full stack developer':    [10000,24000],
  'data scientist':           [12000,28000], 'data analyst':            [7000,16000],
  'devops engineer':          [12000,26000], 'cybersecurity':           [12000,28000],
  'product manager':          [12000,30000], 'project manager':         [10000,24000],
  'civil engineer':           [7000,18000],  'mechanical engineer':     [7000,18000],
  'electrical engineer':      [7000,20000],  'accountant':              [4000,12000],
  'finance manager':          [12000,28000], 'financial analyst':       [6000,16000],
  'doctor':                   [18000,55000], 'nurse':                   [5000,14000],
  'pharmacist':               [6000,16000],  'hr manager':              [8000,20000],
  'sales manager':            [8000,22000],  'marketing manager':       [8000,22000],
  'operations manager':       [10000,24000], 'graphic designer':        [4000,12000],
  'architect':                [8000,22000],  'quantity surveyor':       [7000,18000],
  'driver':                   [1500,4000],   'security guard':          [1500,3500],
  'chef':                     [3000,10000],  'teacher':                 [4000,12000],
};

/* ══════════════════════════════════════════════════════════════
   3. INDUSTRY SKILL SUGGESTIONS
══════════════════════════════════════════════════════════════ */
const SKILL_SUGGESTIONS = {
  tech:        ['JavaScript','Python','React','Node.js','SQL','AWS','Git','Docker','TypeScript','REST APIs'],
  engineering: ['AutoCAD','Primavera','MS Project','BIM','SAP','FIDIC','ISO 9001','HSE','Civil 3D','ETABS'],
  healthcare:  ['Patient Care','Clinical Assessment','EMR Systems','ACLS','BLS','Infection Control','Medication Management','HAAD License','DHA License','SCHS'],
  finance:     ['IFRS','GAAP','SAP','QuickBooks','Financial Modeling','Budgeting','Audit','VAT','Zakat','Excel'],
  hr:          ['HRMS','Recruitment','Performance Management','Saudi Labor Law','Payroll','GOSI','Saudization','Nitaqat'],
  sales:       ['CRM','Salesforce','Business Development','B2B Sales','Negotiation','Market Analysis','Account Management'],
  default:     ['Microsoft Office','Communication','Leadership','Problem Solving','Teamwork','Arabic','English','Project Management']
};

/* ══════════════════════════════════════════════════════════════
   4. GULF TIPS PER STEP
══════════════════════════════════════════════════════════════ */
const GULF_TIPS = [
  '<strong>Gulf CVs require a professional photo</strong> — 90% of Gulf employers expect it. Use a plain white or light background, formal attire, no sunglasses. Avoid selfies.',
  '<strong>Keep your summary under 5 lines</strong> — Gulf HR teams scan quickly. Lead with years of experience, then 2-3 key achievements. Mention Gulf/Saudi experience if you have it.',
  '<strong>List all certifications</strong> — Gulf employers value professional qualifications heavily. Include Saudi Council of Engineers, HAAD, DHA, PMP, ACCA, CPA, or any Gulf-specific licence.',
  '<strong>Technical skills first</strong> — Put your strongest, most relevant skills at the top. Gulf employers use ATS systems — match keywords from the job description exactly.',
  '<strong>References matter in the Gulf</strong> — Wasta (connections) is important. If your reference is a senior professional in the region, it significantly strengthens your application.',
  '<strong>ATS-friendly formats score higher</strong> — Choose Classic or Government template for the best ATS compatibility. Avoid heavy graphics or tables if applying through online portals.'
];

/* ══════════════════════════════════════════════════════════════
   5. TEMPLATE ACCENT COLORS
══════════════════════════════════════════════════════════════ */
const TEMPLATE_COLORS = {
  classic: ['#0D1B2A','#1e3a5f','#1a1a2e','#2d3748','#1f2937','#0f172a'],
  modern:  ['#0ea5e9','#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b'],
  health:  ['#0891b2','#0284c7','#0369a1','#2563eb','#059669','#7c3aed'],
  trades:  ['#f97316','#ef4444','#eab308','#22c55e','#06b6d4','#8b5cf6'],
  gov:     ['#006c35','#065f46','#1e3a5f','#1a1a2e','#422006','#4c1d95'],
};

/* ══════════════════════════════════════════════════════════════
   6. AUTOSAVE
══════════════════════════════════════════════════════════════ */
function autosave() {
  try {
    localStorage.setItem(RB.autosaveKey, JSON.stringify(RB.data));
  } catch(e) {}
}
function scheduleAutosave() {
  clearTimeout(RB.autosaveTimer);
  RB.autosaveTimer = setTimeout(autosave, 2000);
}
function loadSavedData() {
  try {
    const saved = localStorage.getItem(RB.autosaveKey);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (parsed.personal?.fullNameEn || parsed.experience?.length || parsed.summary?.text) {
      RB.data = { ...RB.data, ...parsed };
      return true;
    }
  } catch(e) {}
  return false;
}

/* ══════════════════════════════════════════════════════════════
   7. STEP NAVIGATION
══════════════════════════════════════════════════════════════ */
function goToStep(n) {
  if (n < 1 || n > RB.totalSteps) return;
  document.querySelectorAll('.rb-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`rb-step-${n}`);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.rb-step').forEach((s, i) => {
    s.classList.remove('active','done');
    if (i + 1 < n) s.classList.add('done');
    else if (i + 1 === n) s.classList.add('active');
  });

  const tip = document.getElementById('rbGulfTip');
  if (tip) tip.innerHTML = GULF_TIPS[n - 1] || GULF_TIPS[0];

  RB.currentStep = n;

  // Scroll up — inside setTimeout so new section is in DOM before scroll
  setTimeout(function() {
    // Desktop: scroll the form panel (it has overflow-y:auto)
    var fp = document.querySelector('.rb-form-panel');
    if (fp) fp.scrollTop = 0;

    // Mobile: scroll the whole window to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 80);

  if (n === 6) renderTemplateSelector();
  updatePreview();
}

function nextStep() {
  if (validateCurrentStep()) {
    goToStep(RB.currentStep + 1);
    autosave();
  }
}
function prevStep() { goToStep(RB.currentStep - 1); }

/* ══════════════════════════════════════════════════════════════
   8. VALIDATION
══════════════════════════════════════════════════════════════ */
function validateCurrentStep() {
  const step = RB.currentStep;
  let ok = true;
  document.querySelectorAll('.rb-input.error, .rb-select.error').forEach(el => el.classList.remove('error'));

  if (step === 1) {
    const name = document.getElementById('rbFullNameEn');
    if (!RB.data.personal.fullNameEn.trim()) {
      if (name) name.classList.add('error');
      showFormMsg('Please enter your full name.'); ok = false;
    }
  }
  return ok;
}

function showFormMsg(msg) {
  let el = document.getElementById('rbFormMsg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rbFormMsg';
    el.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:9px;padding:.6rem .9rem;font-size:.8rem;color:#dc2626;margin-bottom:.75rem';
    const section = document.querySelector('.rb-section.active');
    if (section) section.prepend(el);
  }
  el.textContent = msg;
  setTimeout(() => { if(el) el.remove(); }, 4000);
}

/* ══════════════════════════════════════════════════════════════
   9. FORM BINDING — sync inputs to RB.data
══════════════════════════════════════════════════════════════ */
function bindField(elId, path) {
  const el = document.getElementById(elId);
  if (!el) return;
  // Restore saved value
  const val = getNestedVal(RB.data, path);
  if (val !== undefined && val !== null) {
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val || '';
  }
  el.addEventListener('input', () => {
    setNestedVal(RB.data, path, el.type === 'checkbox' ? el.checked : el.value);
    scheduleAutosave();
    updatePreview();
    updateATS();

    // Salary benchmark
    if (path === 'personal.jobTitle') checkSalaryBenchmark(el.value);
    // Expiry warnings
    if (path === 'personal.passportExpiry' || path === 'personal.iqamaNumber') checkExpiry(elId, el.value);
    // Char counts
    if (el.dataset.maxlen) updateCharCount(el);
  });
  el.addEventListener('change', () => {
    setNestedVal(RB.data, path, el.type === 'checkbox' ? el.checked : el.value);
    scheduleAutosave();
    updatePreview();
    updateATS();
  });
}

function getNestedVal(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}
function setNestedVal(obj, path, val) {
  const keys = path.split('.');
  let cur = obj;
  keys.slice(0, -1).forEach(k => { if (!cur[k]) cur[k] = {}; cur = cur[k]; });
  cur[keys[keys.length - 1]] = val;
}

function updateCharCount(el) {
  const max = parseInt(el.dataset.maxlen);
  const len = el.value.length;
  const counter = document.getElementById(el.id + 'Count');
  if (!counter) return;
  counter.textContent = `${len} / ${max}`;
  counter.className = 'rb-char-count' + (len > max * .9 ? (len >= max ? ' over' : ' warn') : '');
}

/* ══════════════════════════════════════════════════════════════
   10. PHOTO UPLOAD
══════════════════════════════════════════════════════════════ */
function initPhotoUpload() {
  const input = document.getElementById('rbPhotoInput');
  const preview = document.getElementById('rbPhotoPrev');
  if (!input || !preview) return;

  // Restore saved photo
  if (RB.data.personal.photoDataUrl) {
    renderPhotoPreview(RB.data.personal.photoDataUrl);
  }

  preview.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      RB.data.personal.photoDataUrl = ev.target.result;
      RB.data.personal.photo = ev.target.result;
      renderPhotoPreview(ev.target.result);
      scheduleAutosave();
      updatePreview();
      updateATS();
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview(dataUrl) {
  const preview = document.getElementById('rbPhotoPrev');
  if (!preview) return;
  preview.innerHTML = `<img src="${dataUrl}" alt="Photo preview">`;
}

/* ══════════════════════════════════════════════════════════════
   11. SKILLS TAG INPUT
══════════════════════════════════════════════════════════════ */
function initSkillsInput() {
  const wrap  = document.getElementById('rbSkillsWrap');
  const input = document.getElementById('rbSkillInput');
  const sugg  = document.getElementById('rbSkillSuggestions');
  if (!wrap || !input) return;

  // Restore saved skills
  RB.data.skills.forEach(s => addSkillTag(s, false));
  renderSkillSuggestions();

  input.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addSkillTag(input.value.trim());
      input.value = '';
    }
    if (e.key === 'Backspace' && !input.value) {
      RB.data.skills.pop();
      const tags = wrap.querySelectorAll('.rb-tag');
      if (tags.length) tags[tags.length - 1].remove();
      updatePreview();
    }
  });

  wrap.addEventListener('click', () => input.focus());
}

function addSkillTag(text, updateData = true) {
  const wrap = document.getElementById('rbSkillsWrap');
  const input = document.getElementById('rbSkillInput');
  if (!wrap || RB.data.skills.includes(text)) return;
  if (updateData) { RB.data.skills.push(text); scheduleAutosave(); updatePreview(); updateATS(); }
  const tag = document.createElement('span');
  tag.className = 'rb-tag';
  tag.innerHTML = `${escHtml(text)} <span class="rb-tag-remove" onclick="removeSkill('${escHtml(text)}',this)">×</span>`;
  wrap.insertBefore(tag, input);
}

window.removeSkill = function(text, el) {
  RB.data.skills = RB.data.skills.filter(s => s !== text);
  el.parentElement.remove();
  scheduleAutosave();
  updatePreview();
  updateATS();
};

function renderSkillSuggestions() {
  const sugg = document.getElementById('rbSkillSuggestions');
  if (!sugg) return;
  // Choose suggestions based on job title
  const title = (RB.data.personal.jobTitle || '').toLowerCase();
  let bucket = SKILL_SUGGESTIONS.default;
  if (/develop|engineer|tech|IT|soft|data|devops|cloud/i.test(title)) bucket = SKILL_SUGGESTIONS.tech;
  else if (/civil|mech|electr|struct|site|constru|arch|survey/i.test(title)) bucket = SKILL_SUGGESTIONS.engineering;
  else if (/nurs|doctor|pharm|medic|health|clinic/i.test(title)) bucket = SKILL_SUGGESTIONS.healthcare;
  else if (/account|financ|audit|tax|zakat/i.test(title)) bucket = SKILL_SUGGESTIONS.finance;
  else if (/hr|human|recruit|talent/i.test(title)) bucket = SKILL_SUGGESTIONS.hr;
  else if (/sales|business develop|account manager/i.test(title)) bucket = SKILL_SUGGESTIONS.sales;

  sugg.innerHTML = bucket.filter(s => !RB.data.skills.includes(s))
    .map(s => `<span class="rb-suggestion-chip" onclick="addSkillTag('${s}')">${s}</span>`)
    .join('');
}

/* ══════════════════════════════════════════════════════════════
   12. DYNAMIC SECTIONS (Experience, Education, etc.)
══════════════════════════════════════════════════════════════ */
function addExperience() {
  const id = Date.now();
  RB.data.experience.push({ id, title:'', company:'', country:'', startDate:'', endDate:'', current: false, description:'' });
  renderExperience();
  scheduleAutosave();
}
function removeExperience(id) {
  RB.data.experience = RB.data.experience.filter(e => e.id !== id);
  renderExperience();
  updatePreview();
  scheduleAutosave();
}
function renderExperience() {
  const wrap = document.getElementById('rbExperienceList');
  if (!wrap) return;
  wrap.innerHTML = RB.data.experience.map((exp, idx) => `
    <div class="rb-dynamic-item" id="exp-${exp.id}">
      <div class="rb-dynamic-header" onclick="toggleCollapse('exp-body-${exp.id}')">
        <span class="rb-dynamic-title">${exp.title || exp.company || `Experience ${idx + 1}`}</span>
        <div style="display:flex;gap:.5rem;align-items:center">
          <i class="bi bi-chevron-down" style="font-size:.75rem;color:var(--text-muted)"></i>
          <button class="rb-remove-btn" onclick="event.stopPropagation();removeExperience(${exp.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div class="rb-collapse-body" id="exp-body-${exp.id}">
        <div class="row g-2">
          <div class="col-sm-6">
            <div class="rb-field-group">
              <label class="rb-label">Job Title</label>
              <input class="rb-input" placeholder="e.g. Software Engineer" value="${escHtml(exp.title)}" oninput="updateExp(${exp.id},'title',this.value)">
            </div>
          </div>
          <div class="col-sm-6">
            <div class="rb-field-group">
              <label class="rb-label">Company Name</label>
              <input class="rb-input" placeholder="e.g. Saudi Aramco" value="${escHtml(exp.company)}" oninput="updateExp(${exp.id},'company',this.value)">
            </div>
          </div>
          <div class="col-sm-6">
            <div class="rb-field-group">
              <label class="rb-label">Country</label>
              <input class="rb-input" placeholder="e.g. Saudi Arabia" value="${escHtml(exp.country)}" oninput="updateExp(${exp.id},'country',this.value)">
            </div>
          </div>
          <div class="col-sm-3">
            <div class="rb-field-group">
              <label class="rb-label">Start Date</label>
              <input type="month" class="rb-input" value="${exp.startDate}" oninput="updateExp(${exp.id},'startDate',this.value)">
            </div>
          </div>
          <div class="col-sm-3">
            <div class="rb-field-group">
              <label class="rb-label">End Date</label>
              <input type="month" class="rb-input" value="${exp.endDate}" ${exp.current?'disabled':''} oninput="updateExp(${exp.id},'endDate',this.value)">
              <label style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem;cursor:pointer">
                <input type="checkbox" ${exp.current?'checked':''} onchange="updateExp(${exp.id},'current',this.checked);this.closest('.rb-dynamic-item').querySelector('input[type=month]:last-of-type').disabled=this.checked"> Current
              </label>
            </div>
          </div>
          <div class="col-12">
            <div class="rb-field-group">
              <label class="rb-label">Description</label>
              <textarea class="rb-textarea" rows="3" placeholder="• Describe your key responsibilities and achievements&#10;• Use bullet points for Gulf CVs&#10;• Include numbers where possible (e.g. managed team of 12)" oninput="updateExp(${exp.id},'description',this.value)">${escHtml(exp.description)}</textarea>
            </div>
          </div>
        </div>
      </div>
    </div>`).join('');
}
window.updateExp = function(id, key, val) {
  const exp = RB.data.experience.find(e => e.id === id);
  if (exp) { exp[key] = val; scheduleAutosave(); updatePreview(); updateATS(); }
  if (key === 'title' || key === 'company') {
    const header = document.querySelector(`#exp-${id} .rb-dynamic-title`);
    if (header) header.textContent = val || `Experience`;
  }
};

function addEducation() {
  const id = Date.now();
  RB.data.education.push({ id, degree:'', institution:'', country:'', startYear:'', endYear:'', grade:'' });
  renderEducation();
  scheduleAutosave();
}
function removeEducation(id) {
  RB.data.education = RB.data.education.filter(e => e.id !== id);
  renderEducation();
  updatePreview();
  scheduleAutosave();
}
function renderEducation() {
  const wrap = document.getElementById('rbEducationList');
  if (!wrap) return;
  wrap.innerHTML = RB.data.education.map((edu, idx) => `
    <div class="rb-dynamic-item" id="edu-${edu.id}">
      <div class="rb-dynamic-header" onclick="toggleCollapse('edu-body-${edu.id}')">
        <span class="rb-dynamic-title">${edu.degree || edu.institution || `Education ${idx + 1}`}</span>
        <div style="display:flex;gap:.5rem;align-items:center">
          <i class="bi bi-chevron-down" style="font-size:.75rem;color:var(--text-muted)"></i>
          <button class="rb-remove-btn" onclick="event.stopPropagation();removeEducation(${edu.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div class="rb-collapse-body" id="edu-body-${edu.id}">
        <div class="row g-2">
          <div class="col-sm-7">
            <div class="rb-field-group">
              <label class="rb-label">Degree / Qualification</label>
              <input class="rb-input" placeholder="e.g. Bachelor of Engineering" value="${escHtml(edu.degree)}" oninput="updateEdu(${edu.id},'degree',this.value)">
            </div>
          </div>
          <div class="col-sm-5">
            <div class="rb-field-group">
              <label class="rb-label">Grade / GPA</label>
              <input class="rb-input" placeholder="e.g. 3.8 / 4.0" value="${escHtml(edu.grade)}" oninput="updateEdu(${edu.id},'grade',this.value)">
            </div>
          </div>
          <div class="col-sm-7">
            <div class="rb-field-group">
              <label class="rb-label">Institution</label>
              <input class="rb-input" placeholder="e.g. King Saud University" value="${escHtml(edu.institution)}" oninput="updateEdu(${edu.id},'institution',this.value)">
            </div>
          </div>
          <div class="col-sm-5">
            <div class="rb-field-group">
              <label class="rb-label">Country</label>
              <input class="rb-input" placeholder="e.g. Saudi Arabia" value="${escHtml(edu.country)}" oninput="updateEdu(${edu.id},'country',this.value)">
            </div>
          </div>
          <div class="col-sm-6">
            <div class="rb-field-group">
              <label class="rb-label">Start Year</label>
              <input type="number" class="rb-input" placeholder="e.g. 2016" value="${edu.startYear}" oninput="updateEdu(${edu.id},'startYear',this.value)" min="1980" max="2030">
            </div>
          </div>
          <div class="col-sm-6">
            <div class="rb-field-group">
              <label class="rb-label">End Year</label>
              <input type="number" class="rb-input" placeholder="e.g. 2020" value="${edu.endYear}" oninput="updateEdu(${edu.id},'endYear',this.value)" min="1980" max="2030">
            </div>
          </div>
        </div>
      </div>
    </div>`).join('');
}
window.updateEdu = function(id, key, val) {
  const edu = RB.data.education.find(e => e.id === id);
  if (edu) { edu[key] = val; scheduleAutosave(); updatePreview(); }
  if (key === 'degree' || key === 'institution') {
    const header = document.querySelector(`#edu-${id} .rb-dynamic-title`);
    if (header) header.textContent = val || 'Education';
  }
};

function addLanguage() {
  const id = Date.now();
  RB.data.languages.push({ id, language:'', proficiency:'Conversational' });
  renderLanguages();
  scheduleAutosave();
}
function removeLanguage(id) {
  RB.data.languages = RB.data.languages.filter(l => l.id !== id);
  renderLanguages();
  updatePreview();
  scheduleAutosave();
}
function renderLanguages() {
  const wrap = document.getElementById('rbLanguageList');
  if (!wrap) return;
  wrap.innerHTML = RB.data.languages.map(lang => `
    <div class="rb-dynamic-item">
      <div class="row g-2 align-items-center">
        <div class="col-sm-5">
          <input class="rb-input" placeholder="Language" value="${escHtml(lang.language)}" oninput="updateLang(${lang.id},'language',this.value)">
        </div>
        <div class="col-sm-5">
          <select class="rb-select" onchange="updateLang(${lang.id},'proficiency',this.value)">
            ${['Basic','Conversational','Fluent','Native'].map(p => `<option ${lang.proficiency===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="col-sm-2">
          <button class="rb-remove-btn w-100" onclick="removeLanguage(${lang.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`).join('');
}
window.updateLang = function(id, key, val) {
  const l = RB.data.languages.find(l => l.id === id);
  if (l) { l[key] = val; scheduleAutosave(); updatePreview(); }
};

function addCertification() {
  const id = Date.now();
  RB.data.certifications.push({ id, name:'', issuer:'', year:'', expiry:'' });
  renderCertifications();
  scheduleAutosave();
}
function removeCertification(id) {
  RB.data.certifications = RB.data.certifications.filter(c => c.id !== id);
  renderCertifications();
  updatePreview();
  scheduleAutosave();
}
function renderCertifications() {
  const wrap = document.getElementById('rbCertList');
  if (!wrap) return;
  wrap.innerHTML = RB.data.certifications.map(cert => `
    <div class="rb-dynamic-item">
      <div class="row g-2 align-items-end">
        <div class="col-sm-5">
          <label class="rb-label">Certification Name</label>
          <input class="rb-input" placeholder="e.g. PMP, ACCA, AWS" value="${escHtml(cert.name)}" oninput="updateCert(${cert.id},'name',this.value)">
        </div>
        <div class="col-sm-3">
          <label class="rb-label">Issuer</label>
          <input class="rb-input" placeholder="e.g. PMI" value="${escHtml(cert.issuer)}" oninput="updateCert(${cert.id},'issuer',this.value)">
        </div>
        <div class="col-sm-2">
          <label class="rb-label">Year</label>
          <input type="number" class="rb-input" placeholder="2023" value="${cert.year}" oninput="updateCert(${cert.id},'year',this.value)" min="2000" max="2030">
        </div>
        <div class="col-sm-2">
          <button class="rb-remove-btn w-100 mt-4" onclick="removeCertification(${cert.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`).join('');
}
window.updateCert = function(id, key, val) {
  const c = RB.data.certifications.find(c => c.id === id);
  if (c) { c[key] = val; scheduleAutosave(); updatePreview(); }
};

function addReference() {
  const id = Date.now();
  RB.data.references.push({ id, name:'', title:'', company:'', phone:'', email:'' });
  renderReferences();
  scheduleAutosave();
}
function removeReference(id) {
  RB.data.references = RB.data.references.filter(r => r.id !== id);
  renderReferences();
  scheduleAutosave();
}
function renderReferences() {
  const wrap = document.getElementById('rbReferenceList');
  if (!wrap) return;
  wrap.innerHTML = RB.data.references.map((ref, idx) => `
    <div class="rb-dynamic-item">
      <div class="rb-dynamic-header">
        <span class="rb-dynamic-title">${ref.name || `Reference ${idx+1}`}</span>
        <button class="rb-remove-btn" onclick="removeReference(${ref.id})"><i class="bi bi-trash"></i></button>
      </div>
      <div class="row g-2">
        <div class="col-sm-6"><input class="rb-input" placeholder="Full Name" value="${escHtml(ref.name)}" oninput="updateRef(${ref.id},'name',this.value)"></div>
        <div class="col-sm-6"><input class="rb-input" placeholder="Job Title" value="${escHtml(ref.title)}" oninput="updateRef(${ref.id},'title',this.value)"></div>
        <div class="col-sm-6"><input class="rb-input" placeholder="Company" value="${escHtml(ref.company)}" oninput="updateRef(${ref.id},'company',this.value)"></div>
        <div class="col-sm-6"><input class="rb-input" placeholder="Phone / WhatsApp" value="${escHtml(ref.phone)}" oninput="updateRef(${ref.id},'phone',this.value)"></div>
      </div>
    </div>`).join('');
}
window.updateRef = function(id, key, val) {
  const r = RB.data.references.find(r => r.id === id);
  if (r) { r[key] = val; scheduleAutosave(); }
};

window.toggleCollapse = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.style.maxHeight && el.style.maxHeight !== '0px') {
    el.style.maxHeight = '0px';
    el.style.overflow = 'hidden';
  } else {
    el.style.maxHeight = el.scrollHeight + 'px';
    el.style.overflow = 'visible';
  }
};

/* ══════════════════════════════════════════════════════════════
   13. SALARY BENCHMARK
══════════════════════════════════════════════════════════════ */
function checkSalaryBenchmark(title) {
  const widget = document.getElementById('rbSalaryWidget');
  if (!widget) return;
  const key = Object.keys(SALARY_MAP).find(k => title.toLowerCase().includes(k));
  if (key) {
    const [min, max] = SALARY_MAP[key];
    document.getElementById('rbSalaryRange').textContent = `SAR ${min.toLocaleString()} – ${max.toLocaleString()} / month`;
    widget.classList.add('show');
  } else {
    widget.classList.remove('show');
  }
  // Also update skill suggestions
  renderSkillSuggestions();
}

/* ══════════════════════════════════════════════════════════════
   14. EXPIRY WARNINGS
══════════════════════════════════════════════════════════════ */
function checkExpiry(elId, dateVal) {
  const warnId = elId + 'Warn';
  let warn = document.getElementById(warnId);
  if (!warn) return;
  if (!dateVal) { warn.classList.remove('show'); return; }
  const expiry = new Date(dateVal);
  const now = new Date();
  const diffDays = Math.floor((expiry - now) / 86400000);
  if (diffDays < 180) {
    warn.textContent = diffDays < 0
      ? `⚠ This document has expired ${Math.abs(diffDays)} days ago — renew before applying!`
      : `⚠ Expires in ${diffDays} days — Gulf employers may require at least 6 months validity.`;
    warn.classList.add('show');
  } else {
    warn.classList.remove('show');
  }
}

/* ══════════════════════════════════════════════════════════════
   15. ATS SCORE
══════════════════════════════════════════════════════════════ */
const ATS_CHECKS = [
  { id:'ats-photo',    label:'Professional photo',      check: () => !!RB.data.personal.photoDataUrl },
  { id:'ats-name',     label:'Full name',               check: () => !!RB.data.personal.fullNameEn.trim() },
  { id:'ats-title',    label:'Job title',               check: () => !!RB.data.personal.jobTitle.trim() },
  { id:'ats-phone',    label:'Phone number',            check: () => !!RB.data.personal.phone.trim() },
  { id:'ats-email',    label:'Email address',           check: () => !!RB.data.personal.email.trim() },
  { id:'ats-nat',      label:'Nationality (Gulf req.)', check: () => !!RB.data.personal.nationality.trim() },
  { id:'ats-summary',  label:'Professional summary',    check: () => RB.data.summary.text.length > 50 },
  { id:'ats-exp',      label:'Work experience',         check: () => RB.data.experience.length > 0 },
  { id:'ats-edu',      label:'Education',               check: () => RB.data.education.length > 0 },
  { id:'ats-skills',   label:'Skills (5+ listed)',      check: () => RB.data.skills.length >= 5 },
  { id:'ats-visa',     label:'Visa/iqama status',       check: () => !!RB.data.personal.visaStatus },
  { id:'ats-notice',   label:'Notice period',           check: () => !!RB.data.personal.noticePeriod },
];

function updateATS() {
  const list = document.getElementById('rbAtsList');
  const ring = document.getElementById('rbAtsRing');
  if (!list || !ring) return;

  const done  = ATS_CHECKS.filter(c => c.check()).length;
  const total = ATS_CHECKS.length;
  const score = Math.round((done / total) * 100);

  // Ring SVG
  const r = 28; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  ring.innerHTML = `
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="6"/>
      <circle cx="35" cy="35" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition:stroke-dashoffset .5s ease"/>
    </svg>
    <div class="score-num">${score}<small>%</small></div>`;

  // Items list (show only first 6 + missing ones)
  const items = ATS_CHECKS.map(c => {
    const pass = c.check();
    return `<div class="rb-ats-item ${pass?'done':'missing'}">
      <i class="bi bi-${pass?'check-circle-fill':'x-circle-fill'}"></i>${c.label}
    </div>`;
  }).join('');
  list.innerHTML = items;
}

/* ══════════════════════════════════════════════════════════════
   16. TEMPLATE SELECTOR
══════════════════════════════════════════════════════════════ */
const TEMPLATES = [
  { id:'classic', name:'Classic Gulf Professional', role:'Engineering · Finance · Government', bg:'#0D1B2A' },
  { id:'modern',  name:'Modern Gulf Executive',     role:'IT · Management · Marketing',       bg:'#1e293b' },
  { id:'health',  name:'Gulf Healthcare',           role:'Nurses · Doctors · Technicians',    bg:'#0891b2' },
  { id:'trades',  name:'Gulf Trades & Technical',   role:'Drivers · Construction · Security', bg:'#1c1917' },
  { id:'gov',     name:'Saudi Government / Vision 2030', role:'Government · Public Sector',   bg:'#006c35' },
];

function renderTemplateSelector() {
  const wrap = document.getElementById('rbTemplateGrid');
  if (!wrap) return;
  wrap.innerHTML = TEMPLATES.map(t => `
    <div class="rb-template-card ${RB.data.settings.template === t.id ? 'selected' : ''}" onclick="selectTemplate('${t.id}')">
      <div class="rb-template-thumb" style="background:${t.bg}">
        <div class="rb-template-check"><i class="bi bi-check-lg"></i></div>
        <div style="text-align:center;padding:.5rem">
          <div style="width:60px;height:8px;background:rgba(255,255,255,.3);border-radius:4px;margin:0 auto .3rem"></div>
          <div style="width:40px;height:5px;background:rgba(255,255,255,.2);border-radius:3px;margin:0 auto .4rem"></div>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:3px;width:70px">
            ${Array(6).fill(0).map((_,i)=>`<div style="height:4px;background:rgba(255,255,255,${i%2?'.15':'.25'});border-radius:2px"></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="rb-template-info">
        <div class="rb-template-name">${t.name}</div>
        <div class="rb-template-role">${t.role}</div>
      </div>
    </div>`).join('');
  renderColorPicker();
  renderFontSizePicker();
}

window.selectTemplate = function(id) {
  RB.data.settings.template = id;
  const defaultColors = { classic:'#0D1B2A', modern:'#0ea5e9', health:'#0891b2', trades:'#f97316', gov:'#006c35' };
  RB.data.settings.accentColor = defaultColors[id] || '#0D1B2A';
  renderTemplateSelector();
  updatePreview();
  scheduleAutosave();
};

function renderColorPicker() {
  const wrap = document.getElementById('rbColorPicker');
  if (!wrap) return;
  const colors = TEMPLATE_COLORS[RB.data.settings.template] || TEMPLATE_COLORS.classic;
  wrap.innerHTML = colors.map(c => `
    <div class="rb-color-dot ${RB.data.settings.accentColor === c ? 'selected' : ''}"
         style="background:${c}" onclick="selectColor('${c}')"></div>`).join('');
}
window.selectColor = function(c) {
  RB.data.settings.accentColor = c;
  renderColorPicker();
  updatePreview();
  scheduleAutosave();
};

function renderFontSizePicker() {
  // Auto-inject the container if the HTML doesn't have it
  let wrap = document.getElementById('rbFontSizePicker');
  if (!wrap) {
    const colorPicker = document.getElementById('rbColorPicker');
    if (!colorPicker) return;
    wrap = document.createElement('div');
    wrap.id = 'rbFontSizePicker';
    colorPicker.parentNode.insertBefore(wrap, colorPicker.nextSibling);
  }
  const current = getFontSize();
  wrap.innerHTML = `
    <div style="margin-top:1.25rem">
      <label class="rb-label" style="display:block;margin-bottom:.5rem">
        <i class="bi bi-fonts me-1"></i>Font Size
      </label>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <button class="rb-size-btn${current===8?' active':''}" onclick="setFontSize(8)">S</button>
        <button class="rb-size-btn${current===9.5?' active':''}" onclick="setFontSize(9.5)">M</button>
        <button class="rb-size-btn${current===11?' active':''}" onclick="setFontSize(11)">L</button>
        <div style="display:flex;align-items:center;gap:.35rem;margin-left:.25rem">
          <label style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">Custom (pt):</label>
          <input type="number" id="rbCustomFontSize" class="rb-input"
            style="width:70px;padding:.25rem .5rem;font-size:.8rem;text-align:center"
            min="7" max="14" step="0.5" value="${current}"
            oninput="setFontSize(parseFloat(this.value)||9.5)">
        </div>
      </div>
    </div>`;
}

window.setFontSize = function(size) {
  if (!size || isNaN(size)) return;
  size = Math.min(14, Math.max(7, size));
  RB.data.settings.fontSize = size;
  renderFontSizePicker();
  updatePreview();
  scheduleAutosave();
};
window.renderFontSizePicker = renderFontSizePicker;

/* ══════════════════════════════════════════════════════════════
   17. LIVE PREVIEW — render template HTML
══════════════════════════════════════════════════════════════ */
function updatePreview() {
  var wrap = document.getElementById('rbPreviewWrap');
  if (!wrap) return;

  wrap.innerHTML = buildResumeHTML(
    RB.data.settings.template || 'classic',
    RB.data.settings.accentColor
  );

  // Run scaling + page overflow check after browser paints content
  setTimeout(function() {
    scalePreview();
    checkPageOverflow();
  }, 80);
}

function scalePreview() {
  var wrap  = document.getElementById('rbPreviewWrap');
  var panel = document.getElementById('rbPreviewPanel');
  if (!wrap || !panel) return;

  // offsetWidth works even before full paint; clientWidth can return 0
  var panelW = panel.offsetWidth || panel.getBoundingClientRect().width;

  if (panelW < 50) {
    // Panel not ready yet (e.g. hidden on mobile) — retry
    setTimeout(scalePreview, 200);
    return;
  }

  var RESUME_W = 794;
  var padding  = 48; // 1.5rem padding on each side
  var available = Math.max(panelW - padding, 100);
  var scale    = available / RESUME_W;
  if (scale > 1) scale = 1;

  // Set resume to full A4 width then scale it down
  wrap.style.width          = RESUME_W + 'px';
  wrap.style.transform      = 'scale(' + scale + ')';
  wrap.style.transformOrigin = 'top left';

  // The element still occupies its original height in layout even after transform.
  // Use negative margin-bottom to collapse the empty space.
  var origH   = wrap.scrollHeight;
  var scaledH = origH * scale;
  wrap.style.marginBottom = (scaledH - origH) + 'px';

  // Also clip horizontal overflow on the panel itself
  panel.style.overflowX = 'hidden';
}

function getFontSize() {
  const fs = RB.data.settings.fontSize;
  // If it's already a number (custom or preset numeric), use it directly
  if (!isNaN(parseFloat(fs))) return parseFloat(fs);
  // Legacy string values
  if (fs === 'small')   return 8;
  if (fs === 'large')   return 11;
  return 9.5; // default 'regular'
}

function buildResumeHTML(tpl, ac) {
  const D = RB.data;
  const p = D.personal;
  const fontSize = getFontSize();

  const photoHtml = p.photoDataUrl
    ? `<img src="${p.photoDataUrl}" alt="${escHtml(p.fullNameEn)}">`
    : `<i class="bi bi-person-fill"></i>`;

  const contactParts = [
    p.phone    && `<span>📞 ${p.phoneCode} ${p.phone}</span>`,
    p.email    && `<span>✉ ${p.email}</span>`,
    (p.currentCity || p.currentCountry) && `<span>📍 ${[p.currentCity, p.currentCountry].filter(Boolean).join(', ')}</span>`,
    p.linkedin && `<span>🔗 ${p.linkedin.replace('https://www.linkedin.com/in/','').replace('https://linkedin.com/in/','')}</span>`,
    p.whatsapp && `<span>💬 WhatsApp: ${p.waCode} ${p.whatsapp}</span>`,
  ].filter(Boolean);

  const expHtml = D.experience.map(e => `
    <div class="tpl-exp-item">
      <div class="tpl-exp-title">${escHtml(e.title)}</div>
      <div class="tpl-exp-company">${escHtml(e.company)}${e.country ? ' · ' + escHtml(e.country) : ''}</div>
      <div class="tpl-exp-dates">${formatDate(e.startDate)} – ${e.current ? 'Present' : formatDate(e.endDate)}</div>
      <div class="tpl-exp-desc">${escHtml(e.description).replace(/\n/g,'<br>')}</div>
    </div>`).join('');

  const eduHtml = D.education.map(e => `
    <div class="tpl-exp-item">
      <div class="tpl-exp-title">${escHtml(e.degree)}</div>
      <div class="tpl-exp-company">${escHtml(e.institution)}${e.country ? ', ' + escHtml(e.country) : ''}</div>
      <div class="tpl-exp-dates">${e.startYear||''}${e.startYear&&e.endYear?' – ':''}${e.endYear||''}${e.grade ? ' · ' + escHtml(e.grade) : ''}</div>
    </div>`).join('');

  const skillHtml = D.skills.map(s => `<span class="tpl-skill-tag">${escHtml(s)}</span>`).join('');
  const langHtml  = D.languages.map(l => `<div class="tpl-lang-item"><span>${escHtml(l.language)}</span><span>${escHtml(l.proficiency)}</span></div>`).join('');
  const certHtml  = D.certifications.map(c => `<div class="tpl-exp-item"><div class="tpl-exp-title">${escHtml(c.name)}</div><div class="tpl-exp-company">${escHtml(c.issuer)}${c.year?' · '+escHtml(c.year):''}</div></div>`).join('');

  const BRANDING = `<div style="text-align:center;font-size:7pt;color:#94a3b8;padding:.5rem;border-top:1px solid #f1f5f9;margin-top:.5rem">Created with <strong>JobOrbit.org</strong> — Gulf Resume Builder</div>`;

  // Force light mode isolation — prevents OS dark theme from inverting resume colors
  const ISOLATE = `color-scheme:light !important;background:#ffffff !important;color:#1e293b !important;width:794px;font-size:${fontSize}pt;box-sizing:border-box;`;

  // Inline style constants — Samsung/Chrome force-dark CANNOT override inline styles
  // These must match the exact CSS values in resume-builder.css
  const S_WHITE  = 'background:#ffffff;color:#1e293b;color-scheme:light;forced-color-adjust:none;';
  const S_LGRAY  = 'background:#f8fafc;color:#1e293b;color-scheme:light;forced-color-adjust:none;';
  const S_DARK   = 'background:#1e293b;color:#ffffff;color-scheme:light;forced-color-adjust:none;';
  const S_MUTED  = 'color:#475569;';
  const S_XMUTED = 'color:#94a3b8;';
  const S_WHITE_75 = 'color:rgba(255,255,255,0.75);';

  if (tpl === 'classic') {
    const color = ac || '#0D1B2A';
    return `<div class="rb-resume tpl-classic" style="${ISOLATE}forced-color-adjust:none;">
      <div class="tpl-header" style="background:${color};color:#ffffff;forced-color-adjust:none;">
        <div class="tpl-photo">${photoHtml}</div>
        <div>
          <div class="tpl-name" style="color:#ffffff;">${escHtml(p.fullNameEn) || 'Your Name'}</div>
          <div class="tpl-title" style="color:rgba(255,255,255,0.75);">${escHtml(p.jobTitle) || 'Your Job Title'}</div>
          <div class="tpl-contact-row" style="color:rgba(255,255,255,0.7);">${contactParts.join('')}</div>
        </div>
      </div>
      <div class="tpl-body" style="${S_WHITE}display:grid;grid-template-columns:1fr 2fr;">
        <div class="tpl-sidebar" style="${S_LGRAY}padding:1.25rem 1.1rem;border-right:1px solid #e2e8f0;">
          ${p.nationality||p.visaStatus||p.noticePeriod||p.expectedSalary ? `
          <div class="tpl-section-title" style="color:${color};border-color:${color};">Personal Info</div>
          ${p.nationality?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Nationality</span>${escHtml(p.nationality)}</div>`:''}
          ${p.visaStatus?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Visa Status</span>${escHtml(p.visaStatus)}</div>`:''}
          ${p.transferableIqama!==undefined&&p.iqamaNumber?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Iqama Transfer</span>${p.transferableIqama?'Yes':'No'}</div>`:''}
          ${p.noticePeriod?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Notice Period</span>${escHtml(p.noticePeriod)}</div>`:''}
          ${p.expectedSalary?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Exp. Salary</span>${escHtml(p.salaryCurrency)} ${escHtml(p.expectedSalary)}</div>`:''}
          ${p.drivingLicense?`<div class="tpl-info-row" style="${S_MUTED}"><span style="font-weight:700;color:#334155;min-width:80px;">Driving Lic.</span>Yes${p.saudiLicense?' (Saudi)':''}</div>`:''}
          ` : ''}
          ${D.skills.length ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Skills</div><div>${D.skills.map(s=>`<span class="tpl-skill-tag" style="display:inline-block;background:#e2e8f0;color:#1e293b;border-radius:4px;padding:.15rem .5rem;font-size:8pt;margin:.15rem .15rem .15rem 0;">${escHtml(s)}</span>`).join('')}</div>` : ''}
          ${D.languages.length ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Languages</div>${D.languages.map(l=>`<div style="display:flex;justify-content:space-between;font-size:9pt;padding:.2rem 0;border-bottom:1px solid #e2e8f0;${S_MUTED}"><span>${escHtml(l.language)}</span><span>${escHtml(l.proficiency)}</span></div>`).join('')}` : ''}
          ${D.certifications.length ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Certifications</div>${certHtml}` : ''}
        </div>
        <div class="tpl-content" style="${S_WHITE}padding:1.25rem 1.5rem;">
          ${D.summary.text ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Professional Summary</div><div class="tpl-summary" style="${S_MUTED}">${escHtml(D.summary.text)}</div>` : ''}
          ${D.experience.length ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Work Experience</div>${expHtml}` : ''}
          ${D.education.length ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Education</div>${eduHtml}` : ''}
          ${D.achievements ? `<div class="tpl-section-title" style="color:${color};border-color:${color};">Achievements</div><div class="tpl-summary" style="${S_MUTED}">${escHtml(D.achievements).replace(/\n/g,'<br>')}</div>` : ''}
          ${buildCustomSectionsHTML(color)}
        </div>
      </div>
      ${BRANDING}
    </div>`;
  }

  if (tpl === 'modern') {
    const color = ac || '#0ea5e9';
    return `<div class="rb-resume tpl-modern" style="${ISOLATE}">
      <div class="tpl-sidebar">
        <div class="tpl-photo">${photoHtml}</div>
        <div class="tpl-name">${escHtml(p.fullNameEn) || 'Your Name'}</div>
        <div class="tpl-title">${escHtml(p.jobTitle) || 'Job Title'}</div>
        <div class="tpl-section-title" style="color:${color}">Contact</div>
        ${p.email?`<div class="tpl-contact-item"><i class="bi bi-envelope"></i>${escHtml(p.email)}</div>`:''}
        ${p.phone?`<div class="tpl-contact-item"><i class="bi bi-telephone"></i>${p.phoneCode} ${p.phone}</div>`:''}
        ${p.whatsapp?`<div class="tpl-contact-item"><i class="bi bi-whatsapp"></i>${p.waCode} ${p.whatsapp}</div>`:''}
        ${p.currentCity||p.currentCountry?`<div class="tpl-contact-item"><i class="bi bi-geo-alt"></i>${[p.currentCity,p.currentCountry].filter(Boolean).join(', ')}</div>`:''}
        ${p.linkedin?`<div class="tpl-contact-item"><i class="bi bi-linkedin"></i>${escHtml(p.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//,''))}</div>`:''}
        ${D.skills.length?`<div class="tpl-section-title" style="color:${color}">Skills</div>
          ${D.skills.map(s=>`<div class="tpl-skill-name">${escHtml(s)}</div><div class="tpl-skill-bar-wrap"><div class="tpl-skill-bar" style="width:80%;background:${color}"></div></div>`).join('')}`:'' }
        ${D.languages.length?`<div class="tpl-section-title" style="color:${color}">Languages</div>
          ${D.languages.map(l=>`<div class="tpl-lang-row"><span>${escHtml(l.language)}</span><span>${escHtml(l.proficiency)}</span></div>`).join('')}`:'' }
        ${p.nationality||p.visaStatus?`<div class="tpl-section-title" style="color:${color}">Gulf Info</div>
          ${p.nationality?`<div class="tpl-contact-item" style="font-size:7.5pt">🌍 ${escHtml(p.nationality)}</div>`:''}
          ${p.visaStatus?`<div class="tpl-contact-item" style="font-size:7.5pt">📋 ${escHtml(p.visaStatus)}</div>`:''}
          ${p.noticePeriod?`<div class="tpl-contact-item" style="font-size:7.5pt">⏰ ${escHtml(p.noticePeriod)}</div>`:''}`:'' }
      </div>
      <div class="tpl-main" style="background:#ffffff !important;color:#1e293b !important;color-scheme:light !important">
        ${D.summary.text?`<div class="tpl-main-title" style="border-color:${color}">Summary</div><div class="tpl-summary">${escHtml(D.summary.text)}</div>`:''}
        ${D.experience.length?`<div class="tpl-main-title" style="border-color:${color}">Experience</div>${expHtml}`:''}
        ${D.education.length?`<div class="tpl-main-title" style="border-color:${color}">Education</div>${eduHtml}`:''}
        ${D.certifications.length?`<div class="tpl-main-title" style="border-color:${color}">Certifications</div>${certHtml}`:''}
        ${D.achievements?`<div class="tpl-main-title" style="border-color:${color}">Achievements</div><div class="tpl-summary">${escHtml(D.achievements)}</div>`:''}
        ${buildCustomSectionsHTML(color)}
      </div>
      ${BRANDING}
    </div>`;
  }

  if (tpl === 'health') {
    const color = ac || '#0891b2';
    return `<div class="rb-resume tpl-health" style="${ISOLATE}">
      <div class="tpl-header" style="background:linear-gradient(135deg,${color},${color}cc)">
        <div class="tpl-photo">${photoHtml}</div>
        <div>
          <div class="tpl-name">${escHtml(p.fullNameEn)||'Your Name'}</div>
          <div class="tpl-title">${escHtml(p.jobTitle)||'Healthcare Professional'}</div>
          <div class="tpl-contact-row">${contactParts.join('')}</div>
        </div>
      </div>
      <div class="tpl-body" style="background:#ffffff;color:#1e293b;color-scheme:light">
        ${D.certifications.length?`<div class="tpl-credentials">${D.certifications.map(c=>`<span class="tpl-cred-badge" style="background:#e0f2fe;color:${color}">${escHtml(c.name)}</span>`).join('')}</div>`:''}
        ${D.summary.text?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Professional Profile</div><div class="tpl-summary">${escHtml(D.summary.text)}</div>`:''}
        ${D.experience.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Clinical Experience</div>
          ${D.experience.map(e=>`<div class="tpl-exp-item"><div class="tpl-exp-dates">${formatDate(e.startDate)}<br>${e.current?'Present':formatDate(e.endDate)}</div><div><div class="tpl-exp-title">${escHtml(e.title)}</div><div class="tpl-exp-hospital">${escHtml(e.company)}${e.country?', '+escHtml(e.country):''}</div><div class="tpl-exp-desc">${escHtml(e.description).replace(/\n/g,'<br>')}</div></div></div>`).join('')}`:''}
        <div class="tpl-two-col">
          <div>
            ${D.education.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Education</div>${eduHtml}`:''}
          </div>
          <div>
            ${D.skills.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Clinical Skills</div><div>${D.skills.map(s=>`<span class="tpl-cred-badge" style="background:#e0f2fe;color:${color};margin:.1rem">${escHtml(s)}</span>`).join('')}</div>`:''}
            ${D.languages.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Languages</div>${langHtml}`:''}
            ${p.nationality||p.visaStatus?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Gulf Info</div>
              ${p.nationality?`<div class="tpl-info-row"><span class="tpl-info-label">Nationality</span>${escHtml(p.nationality)}</div>`:''}
              ${p.visaStatus?`<div class="tpl-info-row"><span class="tpl-info-label">Visa</span>${escHtml(p.visaStatus)}</div>`:''}
              ${p.noticePeriod?`<div class="tpl-info-row"><span class="tpl-info-label">Notice</span>${escHtml(p.noticePeriod)}</div>`:''}`:'' }
          </div>
        </div>
        ${D.achievements?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Achievements</div><div class="tpl-summary">${escHtml(D.achievements).replace(/\n/g,'<br>')}</div>`:''}
        ${buildCustomSectionsHTML(color)}
      </div>
      ${BRANDING}
    </div>`;
  }

  if (tpl === 'trades') {
    const color = ac || '#f97316';
    return `<div class="rb-resume tpl-trades" style="${ISOLATE}">
      <div class="tpl-header">
        <div class="tpl-photo">${photoHtml}</div>
        <div>
          <div class="tpl-name">${escHtml(p.fullNameEn)||'Your Name'}</div>
          <div class="tpl-title" style="color:${color}">${escHtml(p.jobTitle)||'Technical Specialist'}</div>
          <div class="tpl-contact-row">${contactParts.join('')}</div>
        </div>
      </div>
      <div class="tpl-skills-bar" style="background:${color}"></div>
      <div class="tpl-body" style="background:#ffffff;color:#1e293b;color-scheme:light">
        ${D.skills.length?`<div class="tpl-skills-section">
          <div class="tpl-section-title" style="border-color:${color}">Key Skills & Competencies</div>
          <div class="tpl-skill-grid">${D.skills.map(s=>`<span class="tpl-skill-tag" style="background:#1c1917">${escHtml(s)}</span>`).join('')}</div>
        </div>`:''}
        ${D.summary.text?`<div class="tpl-summary" style="border-color:${color}">${escHtml(D.summary.text)}</div>`:''}
        ${D.experience.length?`<div class="tpl-section-title" style="border-color:${color}">Work Experience</div>${D.experience.map(e=>`<div class="tpl-exp-item" style="border-color:${color}"><div class="tpl-exp-title">${escHtml(e.title)}</div><div class="tpl-exp-company">${escHtml(e.company)}${e.country?', '+escHtml(e.country):''}</div><div class="tpl-exp-dates">${formatDate(e.startDate)} – ${e.current?'Present':formatDate(e.endDate)}</div><div class="tpl-exp-desc">${escHtml(e.description).replace(/\n/g,'<br>')}</div></div>`).join('')}`:''}
        ${D.education.length||D.certifications.length?`<div class="tpl-section-title" style="border-color:${color}">Education & Certifications</div>${eduHtml}${certHtml}`:''}
        ${D.achievements?`<div class="tpl-section-title" style="border-color:${color}">Achievements</div><div class="tpl-summary" style="color:#475569">${escHtml(D.achievements).replace(/\n/g,'<br>')}</div>`:''}
        ${buildCustomSectionsHTML(color)}
        ${p.nationality||p.visaStatus||p.noticePeriod?`<div class="tpl-section-title" style="border-color:${color}">Personal Details</div>
          <div style="display:flex;flex-wrap:wrap;gap:.25rem .75rem;font-size:8.5pt;color:#475569">
            ${p.nationality?`<span><strong>Nationality:</strong> ${escHtml(p.nationality)}</span>`:''}
            ${p.visaStatus?`<span><strong>Visa:</strong> ${escHtml(p.visaStatus)}</span>`:''}
            ${p.noticePeriod?`<span><strong>Notice:</strong> ${escHtml(p.noticePeriod)}</span>`:''}
            ${p.drivingLicense?`<span><strong>Driving Licence:</strong> Yes${p.saudiLicense?' (Saudi)':''}</span>`:''}
          </div>`:'' }
      </div>
      ${BRANDING}
    </div>`;
  }

  if (tpl === 'gov') {
    const color = ac || '#006c35';
    return `<div class="rb-resume tpl-gov" style="${ISOLATE}">
      <div class="tpl-header" style="background:${color}">
        <div class="tpl-photo-wrap"><div class="tpl-photo">${photoHtml}</div></div>
        <div>
          ${p.nationality?`<div class="tpl-nationality-badge">🌍 ${escHtml(p.nationality)}</div>`:'' }
          <div class="tpl-name">${escHtml(p.fullNameEn)||'Your Name'}</div>
          ${p.fullNameAr?`<div style="font-size:11pt;color:rgba(255,255,255,.7);margin:.1rem 0 .4rem;direction:rtl">${escHtml(p.fullNameAr)}</div>`:''}
          <div class="tpl-title">${escHtml(p.jobTitle)||'Your Position'}</div>
          <div class="tpl-contact-row">${contactParts.join('')}</div>
        </div>
      </div>
      <div class="tpl-info-strip" style="background:#f0fdf4;color-scheme:light">
        ${p.maritalStatus?`<div class="tpl-info-item"><span class="tpl-info-item-label">Marital Status</span><span class="tpl-info-item-val">${escHtml(p.maritalStatus)}</span></div>`:''}
        ${p.dob?`<div class="tpl-info-item"><span class="tpl-info-item-label">Date of Birth</span><span class="tpl-info-item-val">${p.dob}</span></div>`:''}
        ${p.visaStatus?`<div class="tpl-info-item"><span class="tpl-info-item-label">Visa Status</span><span class="tpl-info-item-val">${escHtml(p.visaStatus)}</span></div>`:''}
        ${p.noticePeriod?`<div class="tpl-info-item"><span class="tpl-info-item-label">Notice Period</span><span class="tpl-info-item-val">${escHtml(p.noticePeriod)}</span></div>`:''}
        ${p.expectedSalary?`<div class="tpl-info-item"><span class="tpl-info-item-label">Expected Salary</span><span class="tpl-info-item-val">${escHtml(p.salaryCurrency)} ${escHtml(p.expectedSalary)}</span></div>`:''}
      </div>
      <div class="tpl-body" style="background:#ffffff;color:#1e293b;color-scheme:light">
        ${D.summary.text?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Professional Summary</div><div class="tpl-summary">${escHtml(D.summary.text)}</div>`:''}
        ${D.experience.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Work Experience</div>${expHtml}`:''}
        <div class="tpl-two-col">
          <div>
            ${D.education.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Education</div>${eduHtml}`:''}
            ${D.certifications.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Certifications</div>${certHtml}`:''}
          </div>
          <div>
            ${D.skills.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Skills</div><div>${D.skills.map(s=>`<span class="tpl-skill-tag" style="background:#dcfce7;color:${color};border-color:#bbf7d0">${escHtml(s)}</span>`).join('')}</div>`:''}
            ${D.languages.length?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Languages</div>${langHtml}`:''}
          </div>
        </div>
        ${D.achievements?`<div class="tpl-section-title" style="color:${color};border-color:${color}">Achievements</div><div class="tpl-summary">${escHtml(D.achievements)}</div>`:''}
        ${buildCustomSectionsHTML(color)}
      </div>
      ${BRANDING}
    </div>`;
  }

  return '<div style="padding:2rem;text-align:center;color:#94a3b8">Select a template to see preview</div>';
}

/* ══════════════════════════════════════════════════════════════
   18. PDF EXPORT — Server-side via Puppeteer (/api/resume/pdf)
   Sends resume HTML to the Express server. Server renders it in
   headless Chrome and returns a perfect PDF. Zero dark mode issues.
   Falls back to print dialog if server call fails.
══════════════════════════════════════════════════════════════ */
async function downloadPDF() {
  var overlay = document.getElementById('rbGenerating');
  if (overlay) overlay.classList.add('show');

  try {
    // 1. Fetch resume CSS + Bootstrap Icons CSS to embed inline
    //    Puppeteer can't reliably load CDN fonts — embed everything
    var cssText   = '';
    var iconsCSS  = '';
    try {
      var r1 = await fetch('/tools/resume-builder/resume-builder.css');
      if (r1.ok) cssText = await r1.text();
    } catch(e) {}
    try {
      var r2 = await fetch('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');
      if (r2.ok) iconsCSS = await r2.text();
    } catch(e) {}

    // 2. Build resume HTML
    var resumeHTML = buildResumeHTML(
      RB.data.settings.template || 'classic',
      RB.data.settings.accentColor
    );

    var fontSize  = getFontSize();
    var firstName = (RB.data.personal.fullNameEn || 'Gulf-Resume').replace(/\s+/g, '-');

    // 3. Font size + print CSS injected after resume CSS so it wins cascade
    var extraCSS = [
      // Font size control
      '.rb-resume { font-size:' + fontSize + 'pt !important; }',
      '.rb-resume * { font-size:inherit; }',
      // Keep sections together — no mid-section page breaks
      '.tpl-exp-item, .rb-section-wrap { break-inside:avoid; page-break-inside:avoid; }',
      '.tpl-section-title { break-after:avoid; page-break-after:avoid; }',
      '.tpl-two-col { break-inside:avoid; page-break-inside:avoid; }',
      // Print settings
      '@media print {',
      '  @page { margin:0; size:A4 portrait; }',
      '  body  { margin:0; padding:0; }',
      '  *     { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }',
      '  .tpl-exp-item, .rb-section-wrap { break-inside:avoid !important; page-break-inside:avoid !important; }',
      '  .tpl-section-title { break-after:avoid !important; page-break-after:avoid !important; }',
      '}',
    ].join('\n');

    // 4. Build full self-contained HTML page to send to server
    var fullHTML = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=794">',
      // Google Fonts — server waits for networkidle0 so fonts load fully
      '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">',
      // Bootstrap Icons embedded inline via iconsCSS — no CDN dependency
      '<style>' + iconsCSS + cssText + extraCSS + '</style>',
      '</head>',
      '<body style="margin:0;padding:0;background:#ffffff">',
      resumeHTML,
      '</body>',
      '</html>',
    ].join('\n');

    // 5. POST to server — server runs Puppeteer and returns PDF bytes
    var response = await fetch('/api/resume/pdf', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        html:     fullHTML,
        filename: firstName + '-JobOrbit',
      }),
    });

    if (!response.ok) {
      var err = await response.json().catch(function(){ return {}; });
      throw new Error(err.error || 'Server returned ' + response.status);
    }

    // 6. Open PDF in new tab — most reliable on Android Chrome
    //    Chrome shows the PDF with a ⬇ download button the user taps
    var blob = await response.blob();
    var url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);

  } catch(err) {
    console.error('[downloadPDF] Error:', err);
    // Graceful fallback — open print dialog
    alert('Direct download failed (' + err.message + ').\n\nOpening print dialog as backup — choose "Save as PDF".');
    printFallback();
  } finally {
    if (overlay) overlay.classList.remove('show');
  }
}

/* Fallback print dialog — used only if Puppeteer server call fails */
async function printFallback() {
  var cssText = '';
  try {
    var r = await fetch('/tools/resume-builder/resume-builder.css');
    if (r.ok) cssText = await r.text();
  } catch(e) {}

  var resumeHTML = buildResumeHTML(
    RB.data.settings.template || 'classic',
    RB.data.settings.accentColor
  );
  var firstName = (RB.data.personal.fullNameEn || 'Gulf-Resume').replace(/\s+/g, '-');
  var win = window.open('', '_blank');
  if (!win) { alert('Please allow popups for this site.'); return; }
  win.document.write(
    '<!DOCTYPE html><html lang="en" data-theme="light"><head>' +
    '<meta charset="UTF-8"><meta name="color-scheme" content="light">' +
    '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">' +
    '<style>' + cssText + '@media print{@page{margin:0;size:A4}body{margin:0}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}}</style>' +
    '</head><body style="margin:0;background:#fff">' + resumeHTML + '</body></html>'
  );
  win.document.close();
  var printed = false;
  function doPrint() { if (!printed) { printed = true; win.focus(); win.print(); } }
  win.addEventListener('load', function() { setTimeout(doPrint, 400); });
  setTimeout(doPrint, 2000);
}

function printResume() { downloadPDF(); }

/* ══════════════════════════════════════════════════════════════
   19. WHATSAPP SHARE
══════════════════════════════════════════════════════════════ */
function shareViaWhatsApp() {
  const p = RB.data.personal;
  const exp = RB.data.experience[0];
  const msg = `*CV Summary — ${p.fullNameEn || 'Job Seeker'}*\n\n` +
    `🎯 *Position:* ${p.jobTitle || 'Not specified'}\n` +
    `🌍 *Nationality:* ${p.nationality || 'Not specified'}\n` +
    `📍 *Location:* ${[p.currentCity, p.currentCountry].filter(Boolean).join(', ') || 'Not specified'}\n` +
    `💼 *Experience:* ${exp ? `${exp.title} at ${exp.company}` : 'See CV'}\n` +
    `⏰ *Notice Period:* ${p.noticePeriod || 'Negotiable'}\n` +
    `💰 *Expected Salary:* ${p.expectedSalary ? p.salaryCurrency + ' ' + p.expectedSalary : 'Negotiable'}\n` +
    `📋 *Visa/Iqama:* ${p.visaStatus || 'Not specified'}${p.transferableIqama ? ' (Transferable)' : ''}\n` +
    `📱 *WhatsApp:* ${p.waCode} ${p.whatsapp || p.phone}\n\n` +
    `_Built with JobOrbit Gulf Resume Builder — joborbit.org_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ══════════════════════════════════════════════════════════════
   20. COPY CV TEXT
══════════════════════════════════════════════════════════════ */
function copyCVText() {
  const p = RB.data.personal;
  const D = RB.data;
  let text = `${p.fullNameEn}\n${p.jobTitle}\n`;
  text += `${p.email} | ${p.phoneCode} ${p.phone} | ${[p.currentCity, p.currentCountry].filter(Boolean).join(', ')}\n\n`;
  if (D.summary.text) text += `SUMMARY\n${D.summary.text}\n\n`;
  if (D.experience.length) {
    text += `EXPERIENCE\n`;
    D.experience.forEach(e => { text += `${e.title} — ${e.company}\n${formatDate(e.startDate)} - ${e.current?'Present':formatDate(e.endDate)}\n${e.description}\n\n`; });
  }
  if (D.education.length) {
    text += `EDUCATION\n`;
    D.education.forEach(e => { text += `${e.degree} — ${e.institution}\n${e.startYear}-${e.endYear}\n`; });
    text += '\n';
  }
  if (D.skills.length) text += `SKILLS\n${D.skills.join(', ')}\n\n`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('rbCopyBtn');
    if (btn) { const old = btn.innerHTML; btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copied!'; setTimeout(() => btn.innerHTML = old, 2000); }
  });
}

/* ══════════════════════════════════════════════════════════════
   21. UTILITIES
══════════════════════════════════════════════════════════════ */
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(val) {
  if (!val) return '';
  const d = new Date(val + '-01');
  if (isNaN(d)) return val;
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════════
   22. INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Inject font size button styles
  const fsBtnStyle = document.createElement('style');
  fsBtnStyle.textContent = `.rb-size-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:7px;border:1.5px solid var(--border,#e2e8f0);background:var(--surface,#fff);color:var(--text,#374151);font-weight:700;font-size:.8rem;cursor:pointer;transition:all .15s}.rb-size-btn:hover{border-color:var(--primary,#0ea5e9);color:var(--primary,#0ea5e9)}.rb-size-btn.active{background:var(--primary,#0ea5e9);border-color:var(--primary,#0ea5e9);color:#fff}`;
  document.head.appendChild(fsBtnStyle);

  // Inject live preview dark-mode isolation — resume always renders in light mode
  const previewIsolation = document.createElement('style');
  previewIsolation.textContent = [
    '#rbPreviewWrap .rb-resume,#rbPreviewWrap .rb-resume *{color-scheme:light !important;}',
    '#rbPreviewWrap .rb-resume{background:#ffffff !important;color:#1e293b !important;}',
    '#rbPreviewWrap .tpl-body,#rbPreviewWrap .tpl-content,#rbPreviewWrap .tpl-main{background:#ffffff !important;}',
    '#rbPreviewWrap .tpl-trades .tpl-body,#rbPreviewWrap .tpl-trades .tpl-skills-section{background:#ffffff !important;color:#1e293b !important;}',
    '#rbPreviewWrap .tpl-modern .tpl-main{background:#ffffff !important;}',
  ].join('');
  document.head.appendChild(previewIsolation);

  // Restore banner
  const hasSaved = loadSavedData();
  const banner = document.getElementById('rbRestoreBanner');
  if (hasSaved && banner) banner.style.display = 'flex';

  // Bind all form fields
  const FIELDS = [
    ['rbFullNameEn',    'personal.fullNameEn'],
    ['rbFullNameAr',    'personal.fullNameAr'],
    ['rbJobTitle',      'personal.jobTitle'],
    ['rbDob',           'personal.dob'],
    ['rbNationality',   'personal.nationality'],
    ['rbReligion',      'personal.religion'],
    ['rbMaritalStatus', 'personal.maritalStatus'],
    ['rbGender',        'personal.gender'],
    ['rbCurrentCity',   'personal.currentCity'],
    ['rbCurrentCountry','personal.currentCountry'],
    ['rbPassportNo',    'personal.passportNumber'],
    ['rbPassportExpiry','personal.passportExpiry'],
    ['rbVisaStatus',    'personal.visaStatus'],
    ['rbIqamaNo',       'personal.iqamaNumber'],
    ['rbTransferable',  'personal.transferableIqama'],
    ['rbNoticePeriod',  'personal.noticePeriod'],
    ['rbExpSalary',     'personal.expectedSalary'],
    ['rbSalaryCurrency','personal.salaryCurrency'],
    ['rbRelocate',      'personal.willingToRelocate'],
    ['rbRelocateCities','personal.relocateCities'],
    ['rbDrivingLic',    'personal.drivingLicense'],
    ['rbSaudiLic',      'personal.saudiLicense'],
    ['rbPhone',         'personal.phone'],
    ['rbPhoneCode',     'personal.phoneCode'],
    ['rbWhatsapp',      'personal.whatsapp'],
    ['rbWaCode',        'personal.waCode'],
    ['rbEmail',         'personal.email'],
    ['rbLinkedin',      'personal.linkedin'],
    ['rbCurrentEmployer','personal.currentEmployer'],
    ['rbSummary',       'summary.text'],
    ['rbAchievements',  'achievements'],
  ];
  FIELDS.forEach(([id, path]) => bindField(id, path));

  // Photo
  initPhotoUpload();

  // Skills
  initSkillsInput();

  // Render saved dynamic sections
  renderExperience();
  renderEducation();
  renderLanguages();
  renderCertifications();
  renderReferences();
  renderCustomSections();

  // Start on step 1
  goToStep(1);

  // Re-scale preview on window resize
  window.addEventListener('resize', function() {
    clearTimeout(window._rbResizeT);
    window._rbResizeT = setTimeout(scalePreview, 200);
  });

  // Extra scale attempts after fonts/layout settle
  setTimeout(scalePreview, 400);
  setTimeout(scalePreview, 1000);

  // Mobile preview toggle
  const toggleBtn = document.getElementById('rbMobileToggle');
  const previewPanel = document.getElementById('rbPreviewPanel');
  const closeBtn = document.getElementById('rbPreviewClose');
  if (toggleBtn) toggleBtn.addEventListener('click', () => previewPanel.classList.toggle('mobile-open'));
  if (closeBtn)  closeBtn.addEventListener('click',  () => previewPanel.classList.remove('mobile-open'));

  // Keyboard shortcut Ctrl+S = save
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); autosave(); }
  });

  // Load site settings (colors, logo, name)
  loadSiteSettings();
});

async function loadSiteSettings() {
  try {
    const d = await fetch('/api/settings').then(r => r.json());
    const s = d.settings;
    if (s.primary_color) document.documentElement.style.setProperty('--primary', s.primary_color);
    if (s.secondary_color) document.documentElement.style.setProperty('--secondary', s.secondary_color);
    if (s.site_name) {
      document.querySelectorAll('.brand-name').forEach(el => el.textContent = s.site_name);
      const fc = document.getElementById('footer-copy-name');
      if (fc) fc.textContent = s.site_name;
    }
    if (s.logo_url) {
      const logo = document.getElementById('site-logo');
      if (logo) { logo.src = s.logo_url; logo.classList.remove('d-none'); }
    }
    applyTheme(localStorage.getItem('theme') || s.default_theme || 'light', false);
  } catch(e) {}
}

function applyTheme(t, save = true) {
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  const i = document.getElementById('themeIcon');
  if (i) i.className = t === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  if (save) localStorage.setItem('theme', t);
}

window.toggleTheme = function() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
};

// Expose all functions to HTML onclick handlers
window.nextStep         = nextStep;
window.prevStep         = prevStep;
window.goToStep         = goToStep;
window.downloadPDF      = downloadPDF;
window.printResume      = printResume;
window.shareViaWhatsApp = shareViaWhatsApp;
window.copyCVText       = copyCVText;
window.addExperience    = addExperience;
window.addEducation     = addEducation;
window.addLanguage      = addLanguage;
window.addCertification = addCertification;
window.addReference     = addReference;
window.removeExperience    = removeExperience;
window.removeEducation     = removeEducation;
window.removeLanguage      = removeLanguage;
window.removeCertification = removeCertification;
window.removeReference     = removeReference;
window.selectTemplate   = selectTemplate;
window.selectColor      = selectColor;
window.autosave         = autosave;
window.updateATS        = updateATS;

/* ══════════════════════════════════════════════════════════════
   CUSTOM SECTIONS — Rich text editor + flexible layout
   Added to Step 5 of the resume builder
══════════════════════════════════════════════════════════════ */
function addCustomSection() {
  var id = Date.now();
  RB.data.customSections.push({ id: id, title: 'My Section', content: '', layout: 'full' });
  renderCustomSections();
  scheduleAutosave();
  setTimeout(function() {
    var el = document.getElementById('cs-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

function removeCustomSection(id) {
  RB.data.customSections = RB.data.customSections.filter(function(s) { return s.id !== id; });
  renderCustomSections();
  updatePreview();
  scheduleAutosave();
}

function renderCustomSections() {
  var wrap = document.getElementById('rbCustomSectionsList');
  if (!wrap) return;

  if (!RB.data.customSections.length) {
    wrap.innerHTML = '<p style="font-size:.82rem;color:var(--text-muted);text-align:center;padding:1rem 0">No custom sections yet. Click "Add Section" to create one.</p>';
    return;
  }

  wrap.innerHTML = RB.data.customSections.map(function(sec, idx) {
    var pbActive = sec.pageBreak ? ' active' : '';
    return '<div class="rb-dynamic-item" id="cs-' + sec.id + '" style="margin-bottom:1rem">' +
      '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem">' +
        '<input class="rb-input" style="flex:1;font-weight:700" value="' + escHtml(sec.title) + '" ' +
          'placeholder="Section Title (e.g. Roles &amp; Responsibilities)" ' +
          'oninput="csUpdateTitle(' + sec.id + ',this.value)">' +
        '<button class="rb-remove-btn" onclick="removeCustomSection(' + sec.id + ')" title="Remove"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '<div style="display:flex;gap:.4rem;margin-bottom:.65rem;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:.72rem;font-weight:700;color:var(--text-muted)">Layout:</span>' +
        '<button class="cs-layout-btn' + (sec.layout==='full'?' active':'') + '" onclick="csSetLayout(' + sec.id + ',\'full\',this)"><i class="bi bi-layout-text-window-reverse"></i> Full Width</button>' +
        '<button class="cs-layout-btn' + (sec.layout==='half'?' active':'') + '" onclick="csSetLayout(' + sec.id + ',\'half\',this)"><i class="bi bi-layout-split"></i> Half Width</button>' +
        '<span style="font-size:.72rem;font-weight:700;color:var(--text-muted);margin-left:.25rem">Page:</span>' +
        '<button class="cs-layout-btn' + pbActive + '" onclick="csTogglePageBreak(' + sec.id + ',this)" title="Start this section on a new page in the PDF">' +
          '<i class="bi bi-file-earmark-break"></i> New Page' +
        '</button>' +
      '</div>' +
      '<div class="cs-toolbar">' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'bold\')" title="Bold"><b>B</b></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'italic\')" title="Italic"><i>I</i></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'underline\')" title="Underline"><u>U</u></button>' +
        '<span class="cs-tb-sep"></span>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'insertUnorderedList\')" title="Bullet list"><i class="bi bi-list-ul"></i></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'insertOrderedList\')" title="Numbered list"><i class="bi bi-list-ol"></i></button>' +
        '<span class="cs-tb-sep"></span>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'justifyLeft\')" title="Left"><i class="bi bi-text-left"></i></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'justifyCenter\')" title="Center"><i class="bi bi-text-center"></i></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'justifyRight\')" title="Right"><i class="bi bi-text-right"></i></button>' +
        '<span class="cs-tb-sep"></span>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'indent\')" title="Indent"><i class="bi bi-text-indent-left"></i></button>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'outdent\')" title="Outdent"><i class="bi bi-text-indent-right"></i></button>' +
        '<span class="cs-tb-sep"></span>' +
        '<button class="cs-tb-btn" onclick="csFmt(' + sec.id + ',\'removeFormat\')" title="Clear formatting" style="color:#dc2626"><i class="bi bi-eraser-fill"></i></button>' +
      '</div>' +
      '<div class="cs-editor" id="cs-ed-' + sec.id + '" contenteditable="true" ' +
        'oninput="csUpdateContent(' + sec.id + ',this)" ' +
        'onkeydown="csKeydown(event,' + sec.id + ')" ' +
        'placeholder="Type your content here...&#10;• Use bullet list for responsibilities&#10;• Tab to indent, Shift+Tab to outdent"></div>' +
      '<p style="font-size:.7rem;color:var(--text-muted);margin:.3rem 0 0"><i class="bi bi-info-circle me-1"></i>Two consecutive Half sections appear side-by-side. Use "New Page" if PDF content overflows to next page.</p>' +
    '</div>';
  }).join('');

  // Restore HTML content into editors
  RB.data.customSections.forEach(function(sec) {
    var ed = document.getElementById('cs-ed-' + sec.id);
    if (ed && sec.content) ed.innerHTML = sec.content;
  });

  // Show page overflow warning in live preview
  checkPageOverflow();
}

window.csUpdateTitle = function(id, val) {
  var sec = RB.data.customSections.find(function(s) { return s.id === id; });
  if (sec) { sec.title = val; scheduleAutosave(); updatePreview(); }
};

window.csSetLayout = function(id, layout, btn) {
  var sec = RB.data.customSections.find(function(s) { return s.id === id; });
  if (!sec) return;
  sec.layout = layout;
  scheduleAutosave();
  updatePreview();
  var item = document.getElementById('cs-' + id);
  if (item) item.querySelectorAll('.cs-layout-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
};

window.csUpdateContent = function(id, el) {
  var sec = RB.data.customSections.find(function(s) { return s.id === id; });
  if (sec) { sec.content = el.innerHTML; scheduleAutosave(); updatePreview(); }
};

window.csFmt = function(id, cmd) {
  var ed = document.getElementById('cs-ed-' + id);
  if (!ed) return;
  ed.focus();
  document.execCommand(cmd, false, null);
  var sec = RB.data.customSections.find(function(s) { return s.id === id; });
  if (sec) { sec.content = ed.innerHTML; scheduleAutosave(); updatePreview(); }
};

window.csKeydown = function(e, id) {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null);
  }
};

function buildCustomSectionsHTML(color) {
  if (!RB.data.customSections || !RB.data.customSections.length) return '';
  var html = '';
  var secs = RB.data.customSections;
  var i = 0;
  while (i < secs.length) {
    var s = secs[i];
    if (!s.title && !s.content) { i++; continue; }
    // Manual page break before this section
    var breakStyle = s.pageBreak ? 'break-before:page;page-break-before:always;' : '';
    if (s.layout === 'half' && secs[i+1] && secs[i+1].layout === 'half') {
      var s2 = secs[i+1];
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:.5rem;' + breakStyle + '">' +
        '<div><div class="tpl-section-title" style="color:' + color + ';border-color:' + color + '">' + escHtml(s.title) + '</div>' +
        '<div style="font-size:9pt;color:#475569;line-height:1.6">' + (s.content || '') + '</div></div>' +
        '<div><div class="tpl-section-title" style="color:' + color + ';border-color:' + color + '">' + escHtml(s2.title) + '</div>' +
        '<div style="font-size:9pt;color:#475569;line-height:1.6">' + (s2.content || '') + '</div></div>' +
        '</div>';
      i += 2;
    } else {
      html += '<div class="rb-section-wrap" style="' + breakStyle + '">' +
        '<div class="tpl-section-title" style="color:' + color + ';border-color:' + color + '">' + escHtml(s.title) + '</div>' +
        '<div style="font-size:9pt;color:#475569;line-height:1.6;margin-bottom:.6rem">' + (s.content || '') + '</div>' +
        '</div>';
      i++;
    }
  }
  return html;
}

window.addCustomSection    = addCustomSection;
window.removeCustomSection = removeCustomSection;
window.renderCustomSections = renderCustomSections;

window.csTogglePageBreak = function(id, btn) {
  var sec = RB.data.customSections.find(function(s){ return s.id === id; });
  if (!sec) return;
  sec.pageBreak = !sec.pageBreak;
  btn.classList.toggle('active', sec.pageBreak);
  updatePreview();
  scheduleAutosave();
};

// Show a dashed "Page 1 ends here" line in the live preview when content exceeds A4 height
function checkPageOverflow() {
  var preview = document.getElementById('rbPreviewWrap') || document.querySelector('.rb-preview-inner');
  if (!preview) return;
  var resume  = preview.querySelector('.rb-resume');
  if (!resume) return;

  // Remove old indicator
  var old = preview.querySelector('.rb-page-overflow-line');
  if (old) old.remove();

  var A4_PX = 1123; // A4 height at 96dpi
  var h     = resume.scrollHeight;
  if (h <= A4_PX) return; // fits on one page — no warning needed

  // Insert a dashed page-break line at the 1123px mark
  var line = document.createElement('div');
  line.className = 'rb-page-overflow-line';
  line.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:' + A4_PX + 'px',
    'border-top:2px dashed #f59e0b',
    'z-index:10',
    'pointer-events:none',
  ].join(';');

  var badge = document.createElement('span');
  badge.style.cssText = 'position:absolute;right:4px;top:-11px;background:#f59e0b;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;white-space:nowrap';
  badge.textContent = '⚠ Page 1 ends here — use "New Page" on next section';
  line.appendChild(badge);

  // Make preview container relative so line positions correctly
  preview.style.position = 'relative';
  preview.appendChild(line);
}