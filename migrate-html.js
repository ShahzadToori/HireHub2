#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   migrate-html.js — run ONCE from /var/www/HireHub2
   Replaces <nav class="navbar..."> and <footer class="site-footer">
   blocks in all HTML files with <!-- NAVBAR --> / <!-- FOOTER -->.
   Also removes duplicate Bootstrap JS + inline loadSettings scripts
   (these are now provided by footer.html partial).

   Usage:
     node migrate-html.js          # preview only (dry run)
     node migrate-html.js --apply  # actually modify files + create backups
     node migrate-html.js --clean  # delete .bak backup files
══════════════════════════════════════════════════════════════ */
const fs   = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const APPLY      = process.argv.includes('--apply');
const CLEAN      = process.argv.includes('--clean');

// ── Clean backups ─────────────────────────────────────────────
if (CLEAN) {
  let count = 0;
  function cleanBaks(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') cleanBaks(p);
      else if (entry.name.endsWith('.bak')) { fs.unlinkSync(p); count++; }
    }
  }
  cleanBaks(PUBLIC_DIR);
  console.log(`🗑  Deleted ${count} .bak files`);
  process.exit(0);
}

if (!APPLY) console.log('🔍 DRY RUN — run with --apply to modify files\n');

// ── Find all HTML files recursively ──────────────────────────
function findHTML(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['partials','node_modules','.git'].includes(entry.name)) findHTML(p, results);
    } else if (entry.name.endsWith('.html') && !entry.name.endsWith('.bak')) {
      results.push(p);
    }
  }
  return results;
}

// ── Replacements ──────────────────────────────────────────────
function replaceNav(html) {
  // Match <nav class="navbar...">...</nav> — greedy enough for nested elements
  return html.replace(/<nav\s[^>]*class="[^"]*navbar[^"]*"[\s\S]*?<\/nav>/, '<!-- NAVBAR -->');
}

function replaceFooter(html) {
  return html.replace(/<footer\s[^>]*class="[^"]*site-footer[^"]*">[\s\S]*?<\/footer>/, '<!-- FOOTER -->');
}

function removeBootstrapScript(html) {
  // Remove Bootstrap bundle <script> tag (now in footer.html)
  return html.replace(
    /\s*<script\s[^>]*src="[^"]*bootstrap[^"]*bundle[^"]*\.js"[^>]*><\/script>/g, ''
  );
}

function removeLoadSettingsScript(html) {
  // Remove inline <script> blocks that contain loadSettings()
  // Pattern: <script> ... loadSettings(); </script>
  return html.replace(
    /<script>(?:(?!<\/script>)[\s\S])*?loadSettings\(\);?\s*<\/script>/g, ''
  );
}

// ── Process files ─────────────────────────────────────────────
const files = findHTML(PUBLIC_DIR);
let changed = 0, skipped = 0;

for (const filePath of files) {
  const rel  = path.relative(PUBLIC_DIR, filePath);
  let   html = fs.readFileSync(filePath, 'utf8');
  const orig = html;

  html = replaceNav(html);
  html = replaceFooter(html);
  html = removeBootstrapScript(html);
  html = removeLoadSettingsScript(html);

  if (html === orig) {
    console.log(`⏭  No changes: ${rel}`);
    skipped++;
    continue;
  }

  if (APPLY) {
    fs.writeFileSync(filePath + '.bak', orig);   // backup
    fs.writeFileSync(filePath, html);
  }

  console.log(`✅ ${APPLY ? 'Migrated' : 'Would migrate'}: ${rel}`);
  changed++;
}

console.log(`\n📊 ${changed} files ${APPLY ? 'migrated' : 'would change'}, ${skipped} unchanged`);
if (APPLY && changed > 0) {
  console.log('💾 Backups saved as .bak — run "node migrate-html.js --clean" to delete them');
}
if (!APPLY) console.log('\nRun with --apply to make changes');
