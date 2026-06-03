/* ── Countries data + searchable picker ── */
const COUNTRIES = [
  /* Gulf/common first */
  'Pakistani','Indian','Bangladeshi','Filipino','Indonesian','Egyptian',
  'Jordanian','Lebanese','Syrian','Yemeni','Sri Lankan','Nepali','Sudanese',
  'Ethiopian','Kenyan','Nigerian','British','American','Saudi Arabian',
  'Emirati','Qatari','Kuwaiti','Bahraini','Omani',
  /* A-Z */
  'Afghan','Albanian','Algerian','Angolan','Argentine','Armenian','Australian',
  'Austrian','Azerbaijani','Bahamian','Belarusian','Belgian','Bolivian',
  'Bosnian','Brazilian','Bulgarian','Burundian','Cambodian','Cameroonian',
  'Canadian','Chilean','Chinese','Colombian','Congolese','Croatian','Cuban',
  'Czech','Danish','Dominican','Dutch','Ecuadorian','Estonian','Finnish',
  'French','Georgian','German','Ghanaian','Greek','Guatemalan','Guinean',
  'Haitian','Hungarian','Iranian','Iraqi','Irish','Israeli','Italian',
  'Ivorian','Jamaican','Japanese','Kazakh','Korean','Kyrgyz','Laotian',
  'Latvian','Libyan','Lithuanian','Luxembourger','Macedonian','Malaysian',
  'Maldivian','Malian','Maltese','Mauritanian','Mexican','Moldovan',
  'Mongolian','Moroccan','Mozambican','Namibian','New Zealander',
  'Nicaraguan','Norwegian','Palestinian','Panamanian','Paraguayan',
  'Peruvian','Polish','Portuguese','Romanian','Russian','Rwandan',
  'Senegalese','Serbian','Singaporean','Slovak','Slovenian','Somali',
  'South African','South Sudanese','Spanish','Swedish','Swiss','Taiwanese',
  'Tajik','Tanzanian','Thai','Togolese','Tunisian','Turkish','Turkmen',
  'Ugandan','Ukrainian','Uruguayan','Uzbek','Venezuelan','Vietnamese',
  'Zambian','Zimbabwean'
];

/* ─ Multi-select picker (employer — accepts multiple nationalities) ─ */
const _cntSel = {};

function initCntPicker(id, initial) {
  _cntSel[id] = [];
  if (initial) {
    initial.split(',').map(s => s.trim()).filter(Boolean).forEach(v => _addCntChip(id, v, false));
  }
  _renderCntDd(id, '');
}

function filterCnt(id, q) {
  _renderCntDd(id, q);
  showCntDd(id);
}

function _renderCntDd(id, q) {
  const dd = document.getElementById(id + 'Dd');
  if (!dd) return;
  const lq = q.toLowerCase();
  const list = COUNTRIES.filter(c => c.toLowerCase().includes(lq) && !_cntSel[id]?.includes(c));
  dd.innerHTML = list.slice(0, 60).map(c =>
    `<div class="cnt-option" onclick="_addCntChip('${id}','${c}',true)">${
      lq ? c.replace(new RegExp('(' + lq.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'), '<strong>$1</strong>') : c
    }</div>`
  ).join('') || '<div class="cnt-option" style="color:var(--text-muted);cursor:default">No results</div>';
}

function _addCntChip(id, value, closeAfter) {
  if (!_cntSel[id]) _cntSel[id] = [];
  if (_cntSel[id].includes(value)) return;
  _cntSel[id].push(value);
  _renderCntChips(id);
  _updateCntHidden(id);
  const s = document.getElementById(id + 'Search');
  if (s) s.value = '';
  _renderCntDd(id, '');
  if (closeAfter) hideCntDd(id);
}

function removeCntChip(id, value) {
  _cntSel[id] = (_cntSel[id] || []).filter(v => v !== value);
  _renderCntChips(id);
  _updateCntHidden(id);
  _renderCntDd(id, document.getElementById(id + 'Search')?.value || '');
}

function _renderCntChips(id) {
  const el = document.getElementById(id + 'Chips');
  if (!el) return;
  el.innerHTML = (_cntSel[id] || []).map(v =>
    `<span class="cnt-chip">${v}<button type="button" onclick="removeCntChip('${id}','${v}')">×</button></span>`
  ).join('');
}

function _updateCntHidden(id) {
  const h = document.getElementById(id);
  if (h) h.value = (_cntSel[id] || []).join(', ');
}

/* ─ Single-select picker (candidate — one nationality) ─ */
function filterCntSingle(id, q) {
  const dd = document.getElementById(id + 'Dd');
  if (!dd) return;
  const lq = q.toLowerCase();
  const list = q.length >= 1
    ? COUNTRIES.filter(c => c.toLowerCase().includes(lq))
    : COUNTRIES;
  dd.innerHTML = list.slice(0, 60).map(c =>
    `<div class="cnt-option" onclick="selectCntSingle('${id}','${c}')">${
      lq ? c.replace(new RegExp('(' + lq.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'), '<strong>$1</strong>') : c
    }</div>`
  ).join('') || '<div class="cnt-option" style="color:var(--text-muted);cursor:default">No results</div>';
  showCntDd(id);
}

function selectCntSingle(id, value) {
  const s = document.getElementById(id + 'Search');
  if (s) { s.value = value; s.style.fontWeight = '600'; }
  /* hidden input: applyNat → applyNationality  or  id directly */
  const hid = id === 'applyNat' ? 'applyNationality' : id;
  const h = document.getElementById(hid);
  if (h) h.value = value;
  hideCntDd(id);
}

/* ─ Shared dropdown show/hide ─ */
function showCntDd(id) {
  document.getElementById(id + 'Dd')?.classList.add('show');
}
function hideCntDd(id) {
  document.getElementById(id + 'Dd')?.classList.remove('show');
}

/* Close all on outside click */
document.addEventListener('click', e => {
  if (!e.target.closest('.cnt-picker')) {
    document.querySelectorAll('.cnt-dropdown.show').forEach(d => d.classList.remove('show'));
  }
});
