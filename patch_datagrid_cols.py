#!/usr/bin/env python3
"""
Adds column picker (show/hide columns) to data-grid.html
Run: python3 patch_datagrid_cols.py
"""
import os, sys

TARGET = os.path.expanduser('~/HireHub2/public/employer/data-grid.html')

with open(TARGET, 'r') as f:
    html = f.read()

if 'dg-col-panel' in html:
    print('Column picker already exists — skipping.')
    sys.exit(0)

# ── 1. CSS ────────────────────────────────────────────────────────────────────
CSS = """
/* ── Column picker ── */
.dg-col-wrap{position:relative}
.dg-col-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:2000;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.4rem .3rem;min-width:195px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:none;max-height:320px;overflow-y:auto}
.dg-col-panel.show{display:block}
.dg-col-item{display:flex;align-items:center;gap:.55rem;padding:.38rem .65rem;border-radius:7px;cursor:pointer;font-size:.81rem;color:var(--text-primary);user-select:none}
.dg-col-item:hover{background:var(--surface)}
.dg-col-item input[type=checkbox]{width:15px;height:15px;cursor:pointer;accent-color:var(--primary);flex-shrink:0}
.dg-col-hdr{padding:.3rem .65rem .2rem;font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center}
.dg-col-hdr button{font-size:.68rem;padding:0;background:none;border:none;color:var(--primary);cursor:pointer;font-weight:600}
"""
html = html.replace('  </style>', CSS + '  </style>', 1)

# ── 2. Toolbar button (after saveStatus div, inside dg-tl) ───────────────────
SAVE_DIV = '      <div id="saveStatus"></div>\n    </div>'
SAVE_WITH_PICKER = '''      <div id="saveStatus"></div>
      <div class="dg-col-wrap" id="colPickerWrap">
        <button class="ep-btn-outline ep-btn-sm" onclick="toggleColPicker()" title="Choose columns">
          <i class="bi bi-layout-three-columns me-1"></i>Columns
        </button>
        <div class="dg-col-panel" id="colPanel"></div>
      </div>
    </div>'''

if SAVE_DIV not in html:
    print('ERROR: Could not find saveStatus div in toolbar — aborting.')
    sys.exit(1)

html = html.replace(SAVE_DIV, SAVE_WITH_PICKER, 1)

# ── 3. Close col panel on outside click (add to existing doc click handler) ──
OLD_CLICK = """document.addEventListener('click',e=>{
  if(!document.getElementById('epUserMenu')?.contains(e.target))
    document.getElementById('epUserDropdown')?.classList.remove('show');
  if(!document.getElementById('exportDd')?.contains(e.target))
    document.getElementById('exportMenu')?.classList.remove('show');
});"""

NEW_CLICK = """document.addEventListener('click',e=>{
  if(!document.getElementById('epUserMenu')?.contains(e.target))
    document.getElementById('epUserDropdown')?.classList.remove('show');
  if(!document.getElementById('exportDd')?.contains(e.target))
    document.getElementById('exportMenu')?.classList.remove('show');
  if(!document.getElementById('colPickerWrap')?.contains(e.target))
    document.getElementById('colPanel')?.classList.remove('show');
});"""

if OLD_CLICK not in html:
    print('ERROR: Could not find document click handler — aborting.')
    sys.exit(1)

html = html.replace(OLD_CLICK, NEW_CLICK, 1)

# ── 4. Call loadColPrefs inside Tabulator tableBuilt callback ─────────────────
OLD_TABULATOR = """    rowSelectionChanged:(data,rows)=>{"""
NEW_TABULATOR = """    tableBuilt:()=>{ loadColPrefs(currentType); },
    rowSelectionChanged:(data,rows)=>{"""

if OLD_TABULATOR not in html:
    print('ERROR: Could not find tableBuilt insertion point — aborting.')
    sys.exit(1)

html = html.replace(OLD_TABULATOR, NEW_TABULATOR, 1)

# ── 5. JS — column picker functions (insert before keyboard shortcuts block) ──
COL_JS = """
/* ══ Column picker ══ */
function toggleColPicker(){
  const panel=document.getElementById('colPanel');
  if(!panel)return;
  const willShow=!panel.classList.contains('show');
  panel.classList.toggle('show',willShow);
  if(willShow)renderColPicker();
}

function renderColPicker(){
  const panel=document.getElementById('colPanel');
  if(!panel||!table)return;
  const cols=table.getColumns().filter(c=>c.getDefinition().field);
  if(!cols.length){panel.innerHTML='<div class="dg-col-item" style="color:var(--text-muted)">No columns</div>';return}
  panel.innerHTML=
    '<div class="dg-col-hdr"><span>Columns</span><button onclick="resetColPrefs()">Reset</button></div>'+
    cols.map(c=>{
      const field=c.getDefinition().field;
      const title=c.getDefinition().title||field;
      const visible=c.isVisible();
      return `<label class="dg-col-item">
        <input type="checkbox" ${visible?'checked':''} onchange="toggleCol('${field}',this.checked)">
        ${title}
      </label>`;
    }).join('');
}

function toggleCol(field,visible){
  if(!table)return;
  const col=table.getColumn(field);
  if(!col)return;
  visible?col.show():col.hide();
  saveColPrefs();
}

function saveColPrefs(){
  if(!table)return;
  const prefs={};
  table.getColumns().forEach(c=>{
    const field=c.getDefinition().field;
    if(field)prefs[field]=c.isVisible();
  });
  localStorage.setItem('dg-cols-'+currentType,JSON.stringify(prefs));
}

function loadColPrefs(type){
  const saved=localStorage.getItem('dg-cols-'+type);
  if(!saved||!table)return;
  try{
    const prefs=JSON.parse(saved);
    table.getColumns().forEach(c=>{
      const field=c.getDefinition().field;
      if(field&&prefs[field]!==undefined){prefs[field]?c.show():c.hide()}
    });
  }catch(e){}
}

function resetColPrefs(){
  localStorage.removeItem('dg-cols-'+currentType);
  buildGrid(currentType);
  document.getElementById('colPanel')?.classList.remove('show');
  showToast('Columns reset to default');
}

"""

KEYBOARD_MARKER = '/* ══ Keyboard shortcuts ══ */'
if KEYBOARD_MARKER not in html:
    print('ERROR: Could not find keyboard shortcuts block — aborting.')
    sys.exit(1)

html = html.replace(KEYBOARD_MARKER, COL_JS + KEYBOARD_MARKER, 1)

# ── Write ─────────────────────────────────────────────────────────────────────
with open(TARGET, 'w') as f:
    f.write(html)

print('Done — column picker added to data-grid.html')
