#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   migrate-blog.js — run ONCE from /var/www/HireHub2
   Imports existing static blog HTML articles into MySQL.

   Usage:
     node migrate-blog.js --dry     # preview only
     node migrate-blog.js --apply   # insert into DB
══════════════════════════════════════════════════════════════ */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./server/db/connection');

const BLOG_DIR = path.join(__dirname, 'public', 'blog');
const DRY      = !process.argv.includes('--apply');
if (DRY) console.log('🔍 DRY RUN — pass --apply to insert into DB\n');

// Simple HTML tag stripper
function stripTags(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

// Extract meta content from HTML
function getMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
         || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
  return m ? m[1] : '';
}

function getOG(html, prop) {
  const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'));
  return m ? m[1] : '';
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].replace(/\s*[–-]\s*JobOrbit.*$/i, '').trim() : '';
}

function getMainContent(html) {
  // Try to find main article content div
  let m = html.match(/<(?:article|main|div[^>]*class="[^"]*(?:post|article|content|blog)[^"]*")[^>]*>([\s\S]*?)<\/(?:article|main|div)>/i);
  if (m) return m[1];
  // Fallback: content between nav and footer
  m = html.match(/<\/nav>([\s\S]*)<footer/i);
  return m ? m[1] : '';
}

function getFeaturedImage(html) {
  const og = getOG(html, 'image');
  if (og && !og.includes('icon')) return og;
  const m = html.match(/<img[^>]*class="[^"]*(?:featured|hero|banner)[^"]*"[^>]*src="([^"]+)"/i);
  return m ? m[1] : '';
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,80);
}

async function run() {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  console.log(`Found ${files.length} HTML files in /blog/\n`);

  let inserted = 0, skipped = 0;

  for (const file of files) {
    const html  = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
    const title = getTitle(html);
    if (!title) { console.log(`⏭  Skipped (no title): ${file}`); skipped++; continue; }

    const slug    = slugify(title) || file.replace('.html','');
    const desc    = getMeta(html, 'description');
    const content = getMainContent(html);
    const img     = getFeaturedImage(html);
    const words   = stripTags(content).split(/\s+/).length;
    const rt      = Math.max(1, Math.round(words / 200));

    // Detect category from URL/title keywords
    let category = 'Gulf Market';
    if (/resume|cv/i.test(title))        category = 'Resume & CV';
    if (/interview/i.test(title))         category = 'Interview Tips';
    if (/salary|pay|benefit/i.test(title)) category = 'Salary & Benefits';
    if (/visa|iqama|permit/i.test(title)) category = 'Visa & Iqama';
    if (/job\s*search|find.*job/i.test(title)) category = 'Job Search';
    if (/career|growth|tips/i.test(title)) category = 'Career Growth';

    console.log(`📄 ${file}`);
    console.log(`   Title:    ${title}`);
    console.log(`   Slug:     ${slug}`);
    console.log(`   Category: ${category}`);
    console.log(`   Words:    ${words} (~${rt} min read)`);
    console.log(`   Image:    ${img || '(none)'}`);
    console.log('');

    if (!DRY) {
      try {
        await db.query(
          `INSERT IGNORE INTO blog_articles
           (title, slug, content, excerpt, featured_image, category, author, reading_time, status, meta_title, meta_description, published_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [title, slug, content, desc, img || null, category, 'JobOrbit Team', rt,
           'published', title, desc]
        );
        inserted++;
      } catch(e) {
        console.log(`   ❌ DB error: ${e.message}`);
      }
    } else {
      inserted++;
    }
  }

  console.log(`\n📊 ${inserted} articles ${DRY ? 'would be' : ''} inserted, ${skipped} skipped`);
  if (!DRY) console.log('✅ Migration complete! Check /blog/ to see your articles.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
