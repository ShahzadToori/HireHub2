/**
 * HireHub – SEO Routes
 * ─────────────────────────────────────────────────────────────
 *  GET /sitemap.xml       Dynamic XML sitemap (jobs + categories + static)
 *  GET /feed.rss          RSS feed (filterable by ?category= ?type= ?q=)
 *  GET /job/:slug         SSR job page for crawlers; real users → SPA
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

/* ── helpers ────────────────────────────────────────────────── */
function xe(str) {                           // XML / HTML escape
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}
function he(str) {                           // HTML-only escape (for href etc.)
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function timeAgo(dateStr) {                  // "2d ago" / "3mo ago" etc.
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24)   return hr + 'h ago';
  const day = Math.floor(hr / 24);
  if (day < 30)  return day + 'd ago';
  const mo = Math.floor(day / 30);
  if (mo < 12)   return mo + 'mo ago';
  return Math.floor(mo / 12) + 'y ago';
}

async function getSetting(key, fallback = '') {
  try {
    const [[row]] = await db.query(
      'SELECT `value` FROM settings WHERE `key`=? LIMIT 1', [key]
    );
    return (row && row.value) ? row.value : fallback;
  } catch { return fallback; }
}

async function getSiteUrl() {
  const v = await getSetting('site_url', '');
  return v ? v.replace(/\/$/, '') : 'https://yourdomain.com';
}

async function getSiteName() {
  return getSetting('site_name', 'JobOrbit');
}

async function getLogoUrl() {
  return getSetting('logo_url', '');
}

/* ══════════════════════════════════════════════════════════════
   GET /sitemap.xml
══════════════════════════════════════════════════════════════ */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const siteUrl = await getSiteUrl();
    const today   = new Date().toISOString().split('T')[0];

    const [jobs] = await db.query(
      `SELECT slug, created_at, updated_at
         FROM jobs
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 10000`
    );

    const [cats] = await db.query(
      `SELECT c.slug, MAX(j.created_at) AS last_job
         FROM categories c
         LEFT JOIN jobs j ON j.category_id = c.id AND j.status = 'active'
         GROUP BY c.id, c.slug
         ORDER BY c.name`
    );

    const [blogs] = await db.query(
      `SELECT slug, updated_at, created_at
         FROM blog_articles
        WHERE status = 'published'
        ORDER BY created_at DESC
        LIMIT 1000`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- ── Static Pages ── -->
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/employer/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${today}</lastmod>
  </url>

  <!-- ── SEO Landing Pages ── -->
  <url>
    <loc>${siteUrl}/aramco-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/hse-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/qc-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/wpr-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/shutdown-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/neom-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/oil-gas-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/jubail-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/dammam-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/riyadh-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/transferable-iqama-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${siteUrl}/mep-jobs</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>

  <!-- ── Category Filter Pages ── -->
${cats.map(c => `  <url>
    <loc>${siteUrl}/?category=${xe(c.slug)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <lastmod>${c.last_job ? new Date(c.last_job).toISOString().split('T')[0] : today}</lastmod>
  </url>`).join('\n')}

  <!-- ── Job Detail Pages ── -->
${jobs.map(j => `  <url>
    <loc>${siteUrl}/job/${xe(j.slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${new Date(j.updated_at || j.created_at).toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}

  <!-- ── Blog Articles ── -->
${blogs.map(b => `  <url>
    <loc>${siteUrl}/blog/${xe(b.slug)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${new Date(b.updated_at || b.created_at).toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}

  <!-- ── Blog Index ── -->
  <url>
    <loc>${siteUrl}/blog/</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>

</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).type('xml').send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /feed.rss
══════════════════════════════════════════════════════════════ */
router.get('/feed.rss', async (req, res) => {
  try {
    const siteUrl  = await getSiteUrl();
    const siteName = await getSiteName();
    const { category, type, q } = req.query;

    const where  = ['j.status = "active"'];
    const params = [];
    if (category) { where.push('c.slug = ?');                         params.push(category); }
    if (type)     { where.push('j.job_type = ?');                     params.push(type); }
    if (q)        { where.push('(j.title LIKE ? OR j.company LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const [jobs] = await db.query(
      `SELECT j.title, j.company, j.location, j.job_type,
              j.description, j.slug, j.created_at, c.name AS category
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE ${where.join(' AND ')}
        ORDER BY j.created_at DESC
        LIMIT 50`,
      params
    );

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xe(siteName)} – Latest Jobs</title>
    <link>${siteUrl}</link>
    <description>Latest job listings on ${xe(siteName)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.rss" rel="self" type="application/rss+xml"/>
    <ttl>60</ttl>
    <image>
      <url>${siteUrl}/images/icon-512x512.svg</url>
      <title>${xe(siteName)}</title>
      <link>${siteUrl}</link>
    </image>
${jobs.map(j => `
    <item>
      <title>${xe(j.title)} at ${xe(j.company)}</title>
      <link>${siteUrl}/job/${xe(j.slug)}</link>
      <guid isPermaLink="true">${siteUrl}/job/${xe(j.slug)}</guid>
      <description><![CDATA[<strong>${j.company}</strong> &bull; ${j.location} &bull; ${j.job_type}<br><br>${j.description.substring(0, 400)}…]]></description>
      <category>${xe(j.category)}</category>
      <pubDate>${new Date(j.created_at).toUTCString()}</pubDate>
    </item>`).join('')}

  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(rss);
  } catch (err) {
    console.error('RSS error:', err);
    res.status(500).send('');
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /job/:slug  – SSR for crawlers, redirect for real users
══════════════════════════════════════════════════════════════ */
router.get('/job/:slug', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*, c.name AS category, c.slug AS cat_slug
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.slug = ? AND j.status = 'active'
        LIMIT 1`,
      [req.params.slug]
    );

    if (rows.length === 0) return next(); // 404 → SPA handles it

    const job      = rows[0];

    // Phase 2: fetch similar jobs (same category, exclude current)
    const [simRows] = await db.query(
      `SELECT j.title, j.company, j.location, j.slug, j.job_type, j.salary, j.created_at
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.category_id = ? AND j.slug != ? AND j.status = 'active'
        ORDER BY j.created_at DESC
        LIMIT 4`,
      [job.category_id, job.slug]
    );
    const siteUrl  = await getSiteUrl();
    const siteName = await getSiteName();
    const logoUrl  = await getLogoUrl();
    const titleFmt = await getSetting('meta_title_format', '');
    const ga4Id    = await getSetting('ga4_id', '');
    const logoSrc  = logoUrl.startsWith('http') ? logoUrl : `${siteUrl}${logoUrl}`;
    const pageTitle = titleFmt
      ? titleFmt.replace('{title}', job.title||'').replace('{company}', job.company||'').replace('{site}', siteName||'')
      : `${job.title} at ${job.company} – ${siteName}`;
    const ga4Script = ga4Id
      ? `  <!-- Google Analytics 4 -->\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`
      : '';

    // Employer logo (for employer-posted jobs)
    let employerLogo = '';
    if (job.employer_id) {
      try {
        const [[emp]] = await db.query('SELECT logo_url FROM employers WHERE id = ?', [job.employer_id]);
        if (emp && emp.logo_url) employerLogo = emp.logo_url;
      } catch {}
    }
    const employerLogoSrc = employerLogo.startsWith('http') ? employerLogo : employerLogo;
    const companyInitial  = (job.company || '?').trim().charAt(0).toUpperCase() || '?';
    const postedAgo       = timeAgo(job.created_at);
    const salaryDisplay   = (job.salary || '').trim();

    // Parse salary from extra_fields
    let extra = {};
    try { if (job.extra_fields) extra = JSON.parse(job.extra_fields); } catch {}

    const canonical  = `${siteUrl}/job/${job.slug}`;
    const datePosted = new Date(job.created_at).toISOString().split('T')[0];
    const metaDesc   = `${job.title} at ${job.company} in ${job.location}. ${job.job_type} · ${job.category}. ${job.description.replace(/\n/g,' ').substring(0, 140)}…`;

    const empTypeMap = {
      'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME',
      'Contract':  'CONTRACTOR', 'Freelance': 'CONTRACTOR', 'Remote': 'FULL_TIME'
    };

    // ── JobPosting schema ─────────────────────────────────────
    const jobSchema = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description,
      datePosted: datePosted,
      validThrough: new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0],
      employmentType: empTypeMap[job.job_type] || 'FULL_TIME',
      url: canonical,
      directApply: !!(job.phone || job.whatsapp || job.email),
      identifier: { '@type': 'PropertyValue', name: siteName, value: String(job.id) },
      hiringOrganization: {
        '@type': 'Organization',
        name: job.company || 'Company Name Not Provided',
        sameAs: siteUrl
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location,
          addressCountry: await getSetting('country_code', 'US')
        }
      }
    };

    if (extra.salary_min || extra.salary_max) {
      jobSchema.baseSalary = {
        '@type': 'MonetaryAmount', currency: 'USD',
        value: { '@type': 'QuantitativeValue', unitText: 'YEAR',
          minValue: extra.salary_min || undefined,
          maxValue: extra.salary_max || undefined }
      };
    }

    // ── BreadcrumbList ─────────────────────────────────────────
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Jobs',         item: siteUrl + '/' },
        { '@type': 'ListItem', position: 2, name: job.category,   item: `${siteUrl}/?category=${job.cat_slug}` },
        { '@type': 'ListItem', position: 3, name: job.title,      item: canonical }
      ]
    };

    // ── Build contact buttons ──────────────────────────────────
    // ── Build contact buttons ──────────────────────────────────
let whatsappUrl = '#';
if (job.whatsapp) {
  const clean = job.whatsapp.replace(/\D/g, '');
  const jobUrl = `${siteUrl}/job/${job.slug}`;
  const msg = `*Job Inquiry: ${job.title}*\n\n` +
    `🏢 *Company:* ${job.company}\n` +
    `📍 *Location:* ${job.location}\n` +
    `💼 *Job Type:* ${job.job_type || 'Full-time'}\n` +
    `🔗 *View full job:* ${jobUrl}\n\n` +
    `Hello, I am very interested in this position. Please find my details attached. Thank you.`;
  whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}
const applyLinkBtn = job.apply_link ? `<a href="${he(job.apply_link)}" class="cbtn" target="_blank"><i>🔗</i> Apply Link</a>` : '';
const contactBtns = [
  job.phone    ? `<a href="tel:${he(job.phone)}"    class="cbtn"><i>📞</i> ${he(job.phone)}</a>` : '',
  job.whatsapp ? `<a href="${whatsappUrl}" class="cbtn" target="_blank"><i>💬</i> WhatsApp</a>` : '',
  job.email    ? `<a href="mailto:${he(job.email)}" class="cbtn"><i>✉️</i> ${he(job.email)}</a>` : '',
  job.map_link ? `<a href="${he(job.map_link)}"     class="cbtn" target="_blank"><i>📍</i> View Location</a>` : '',
  applyLinkBtn
].filter(Boolean).join('\n          ');

    // ── Full SSR HTML ──────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${he(pageTitle)}</title>
  <meta name="description" content="${he(metaDesc)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${he(canonical)}">

  <!-- Open Graph -->
  <meta property="og:type"        content="article">
  <meta property="og:title"       content="${he(job.title + ' at ' + job.company)}">
  <meta property="og:description" content="${he(metaDesc)}">
  <meta property="og:url"         content="${he(canonical)}">
  <meta property="og:site_name"   content="${he(siteName)}">
  <meta property="og:image"       content="${he(siteUrl)}/images/icon-512x512.svg">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${he(job.title + ' at ' + job.company)}">
  <meta name="twitter:description" content="${he(metaDesc)}">

  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(jobSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>

  <!-- Redirect real users to SPA (only once, prevents loop) -->
  <script>
    var ua = navigator.userAgent;
    var isBot = /googlebot|bingbot|yandex|baidu|duckduck|twitterbot|facebookexternalhit|linkedinbot|slackbot|whatsapp|crawler|spider|bot/i.test(ua);
    if (!isBot && window.location.hash !== '#ssr') {
      // redirect removed — SSR page shown directly
    }
  </script>

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#161616;line-height:1.65}
    a{color:#0f62fe;text-decoration:none}
    a:hover{text-decoration:underline}
    .wrap{max-width:780px;margin:0 auto;padding:2rem 1.25rem}

    .seo-header{height:64px;display:flex;align-items:center;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:100}
    .seo-header-inner{max-width:780px;margin:0 auto;padding:0 1.25rem;width:100%;display:flex;align-items:center}
    .seo-logo{height:36px;display:block}

    .bc{font-size:.82rem;color:#6b7280;margin-bottom:1.5rem;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
    .bc a{color:#0f62fe}
    .bc span{color:#9ca3af}

    .back{display:inline-flex;align-items:center;gap:.3rem;color:#0f62fe;font-size:.88rem;margin-bottom:1.5rem}
    .back:hover{text-decoration:underline}

    .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    .card-head{padding:1.75rem 2rem 1.5rem;border-bottom:1px solid #f1f3f4}
    .card-body{padding:1.75rem 2rem}
    .apply-section{background:#f8fafc;border-top:1px solid #f1f3f4}

    .job-head{display:flex;gap:1rem;align-items:flex-start;margin-bottom:.85rem}
    .company-avatar{width:54px;height:54px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.4rem;color:#fff;background:linear-gradient(135deg,#0f62fe,#1a56db);overflow:hidden}
    .company-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    .job-head-info{flex:1;min-width:0;padding-top:.1rem}
    .company-name{font-size:.92rem;color:#475569;font-weight:600;margin-top:.25rem}

    .badges{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem}
    .badge{display:inline-block;padding:.22rem .7rem;border-radius:100px;font-size:.72rem;font-weight:600;letter-spacing:.3px}
    .b-cat{background:#e8f0fe;color:#1a56db}
    .b-type{background:transparent;color:#0f62fe;border:1px solid #0f62fe}
    .b-feat{background:#0f62fe;color:#fff}
    .b-spon{background:#ff6b35;color:#fff}
    .b-visa{background:#dcfce7;color:#166534}
    .b-cv{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}

    h1{font-size:clamp(1.4rem,3vw,1.9rem);font-weight:800;color:#0f172a;margin-bottom:0;line-height:1.2}

    .meta-grid{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
    .chip{display:inline-flex;align-items:center;gap:.3rem;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:100px;padding:.28rem .8rem;font-size:.8rem;color:#475569}
    .chip-salary{background:#dcfce7;border-color:#bbf7d0;color:#166534;font-weight:700}

    .section-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:.85rem;padding-bottom:.5rem;border-bottom:1px solid #f1f3f4}
    .desc{font-size:.95rem;line-height:1.85;color:#334155;white-space:pre-line}

    .apply-head{font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:.6rem}
    .apply-sub{font-size:.875rem;color:#64748b;margin-top:.6rem;margin-bottom:0}
    .apply-cta{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;background:#0f62fe;color:#fff;border:none;border-radius:10px;padding:.85rem 1.5rem;font-weight:700;font-size:.95rem;cursor:pointer;text-decoration:none;font-family:inherit;transition:background .15s}
    .apply-cta:hover{background:#0353e9;text-decoration:none}
    .apply-divider{display:flex;align-items:center;gap:.75rem;margin:1.25rem 0;font-size:.72rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em}
    .apply-divider::before,.apply-divider::after{content:'';flex:1;height:1px;background:#e5e7eb}

    .contact-row{display:flex;flex-wrap:wrap;gap:.65rem}
    .cbtn{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.25rem;border-radius:9px;font-weight:600;font-size:.875rem;text-decoration:none;background:#fff;color:#334155;border:1.5px solid #e2e8f0;transition:border-color .15s,background .15s}
    .cbtn:hover{border-color:#0f62fe;background:#f8faff;text-decoration:none}

    .cnt-picker{position:relative}
    .cnt-dropdown{position:absolute;top:calc(100% + 3px);left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:2000;max-height:210px;overflow-y:auto;display:none}
    .cnt-dropdown.show{display:block}
    .cnt-option{padding:.48rem .75rem;cursor:pointer;font-size:.83rem;color:#161616}
    .cnt-option:hover{background:#f9fafb}
    .cnt-option strong{color:#0f62fe;font-weight:700}

    /* Apply modal */
    .seo-apply-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center;padding:1rem}
    .seo-apply-overlay.open{display:flex}
    .seo-apply-modal{background:#fff;border-radius:18px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .seo-apply-header{padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
    .seo-apply-header h3{margin:0;font-size:1.05rem;font-weight:800;color:#161616}
    .seo-apply-body{padding:1.25rem 1.5rem}
    .seo-field{margin-bottom:.85rem}
    .seo-label{display:block;font-size:.78rem;font-weight:700;color:#6b7280;margin-bottom:.3rem}
    .seo-input{width:100%;padding:.6rem .85rem;border:1.5px solid #e5e7eb;border-radius:9px;font-size:.9rem;outline:none;box-sizing:border-box}
    .seo-input:focus{border-color:#0f62fe}
    .seo-row{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
    .seo-apply-footer{padding:1rem 1.5rem;border-top:1px solid #e5e7eb;display:flex;gap:.5rem;justify-content:flex-end}
    .seo-btn-primary{background:#0f62fe;color:#fff;border:none;padding:.65rem 1.25rem;border-radius:9px;font-weight:700;cursor:pointer;font-size:.88rem}
    .seo-btn-secondary{background:#f1f3f4;color:#374151;border:none;padding:.65rem 1.25rem;border-radius:9px;font-weight:600;cursor:pointer;font-size:.88rem}
    .seo-msg{padding:.65rem 1rem;border-radius:8px;font-size:.83rem;margin-bottom:.75rem}

    /* Similar Jobs */
    .sim-section{margin-top:2rem}
    .sim-heading{font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:2px solid #e5e7eb}
    .sim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem}
    .sim-card{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;text-decoration:none;transition:border-color .15s,box-shadow .15s}
    .sim-card:hover{border-color:#0f62fe;box-shadow:0 4px 16px rgba(15,98,254,.08);text-decoration:none}
    .sim-title{font-weight:700;font-size:.9rem;color:#0f172a;margin-bottom:.3rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .sim-company{font-size:.78rem;color:#64748b;margin-bottom:.3rem}
    .sim-meta{display:flex;flex-wrap:wrap;gap:.4rem;font-size:.75rem;color:#94a3b8;margin-bottom:.3rem}
    .sim-salary{font-size:.78rem;font-weight:700;color:#166534}

    footer{margin-top:3rem;padding:1.5rem 1.25rem;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}

    /* Mobile sticky apply bar */
    .mobile-apply-bar{display:none}
    @media(max-width:600px){
      .card-head,.card-body{padding:1.25rem}
      .wrap{padding-bottom:5.5rem}
      .mobile-apply-bar{display:flex;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;padding:.65rem 1rem;box-shadow:0 -4px 16px rgba(0,0,0,.08);z-index:500}
      .mobile-apply-bar .apply-cta{margin:0}
    }
  </style>
${ga4Script}
</head>
<body>

<header class="seo-header">
  <div class="seo-header-inner">
    <a href="${siteUrl}/"><img src="${he(logoSrc)}" alt="${he(siteName)}" class="seo-logo"></a>
  </div>
</header>

<div class="wrap">
  <a class="back" href="/">← All Jobs</a>

  <nav class="bc" aria-label="Breadcrumb">
    <a href="/">Jobs</a>
    <span>›</span>
    <a href="/?category=${he(job.cat_slug)}">${he(job.category)}</a>
    <span>›</span>
    <span>${he(job.title)}</span>
  </nav>

  <div class="card">
    <div class="card-head">
      <div class="job-head">
        <div class="company-avatar">
          ${employerLogo ? `<img src="${he(employerLogoSrc)}" alt="${he(job.company)}" onerror="this.parentElement.textContent='${he(companyInitial)}';this.remove();">` : he(companyInitial)}
        </div>
        <div class="job-head-info">
          <h1>${he(job.title)}</h1>
          <div class="company-name">${he(job.company) || 'Company name not provided'}</div>
        </div>
      </div>
      <div class="badges">
        ${job.featured  == 1 ? '<span class="badge b-feat">⭐ Featured</span>' : ''}
        ${job.sponsored == 1 ? '<span class="badge b-spon">Sponsored</span>' : ''}
        <span class="badge b-cat">${he(job.category)}</span>
        <span class="badge b-type">${he(job.job_type || 'Full-time')}</span>
        ${job.visa_sponsored == 1 ? '<span class="badge b-visa">✈️ Visa Sponsored</span>' : ''}
        ${job.require_cv == 1 ? '<span class="badge b-cv">📄 CV Required</span>' : ''}
      </div>
      <div class="meta-grid">
        <span class="chip">📍 ${he(job.location)}</span>
        ${salaryDisplay ? `<span class="chip chip-salary">💰 ${he(salaryDisplay)}</span>` : ''}
        ${job.positions > 1 ? `<span class="chip">👥 ${job.positions} positions</span>` : ''}
        <span class="chip">🗓 ${postedAgo}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="section-label">Job Description</div>
      <div class="desc">${he(job.description)}</div>
      ${job.requirements ? `<div class="section-label" style="margin-top:1.25rem">Requirements</div>
      <div class="desc">${he(job.requirements)}</div>` : ''}
    </div>
    <div class="card-body apply-section">
      <div class="apply-head">${job.employer_id ? 'Apply for this Job' : 'Apply Now'}</div>
      ${job.employer_id ? `
      <button class="apply-cta" onclick="openSeoApply()">📩 Apply Now</button>
      <p class="apply-sub">${he(job.company) || 'The employer'} will review your application directly on ${he(siteName)}.</p>
      ` : ''}
      ${contactBtns ? `
      ${job.employer_id
        ? '<div class="apply-divider">Or contact directly</div>'
        : `<p class="apply-sub" style="margin-top:0;margin-bottom:1.1rem">Contact ${he(job.company) || 'the employer'} directly — no middlemen.</p>`}
      <div class="contact-row">${contactBtns}</div>
      ` : ''}
      ${(!job.employer_id && !contactBtns) ? '<p style="color:#9ca3af;font-size:.88rem">No contact info provided.</p>' : ''}
      <p style="margin-top:1.1rem;font-size:.78rem;color:#9ca3af">
        Or <a href="/">browse more jobs</a> on ${he(siteName)}
      </p>
    </div>
  </div>

  <!-- Phase 2: Similar Jobs -->
  ${simRows.length > 0 ? `
  <div class="sim-section">
    <h2 class="sim-heading">Similar Jobs in ${he(job.category)}</h2>
    <div class="sim-grid">
      ${simRows.map(j => `
      <a href="${siteUrl}/job/${xe(j.slug)}" class="sim-card">
        <div class="sim-title">${he(j.title)}</div>
        <div class="sim-company">🏢 ${he(j.company) || he(siteName)}</div>
        <div class="sim-meta">
          <span>📍 ${he(j.location)}</span>
          <span>${he(j.job_type || 'Full-time')}</span>
        </div>
        ${j.salary ? `<div class="sim-salary">💰 ${he(j.salary)}</div>` : ''}
      </a>`).join('')}
    </div>
  </div>` : ''}

  <!-- Phase 2: Report a Job link -->
  <p style="margin-top:2rem;text-align:center;font-size:.78rem;color:#9ca3af">
    ⚑ <a href="/feedback.html?type=report_job&subject=${encodeURIComponent('Job Report: ' + job.title)}&msg=${encodeURIComponent('Listing URL: ' + (process.env.SITE_URL || 'https://joborbit.org') + '/job/' + job.slug + '\n\nReason: ')}" style="color:#9ca3af">Report this listing</a> if it appears fake, expired, or inappropriate.
  </p>
</div>

${(job.employer_id || job.whatsapp || job.phone || job.email) ? `
<div class="mobile-apply-bar">
  ${job.employer_id
    ? `<button class="apply-cta" onclick="openSeoApply()">📩 Apply Now</button>`
    : job.whatsapp
      ? `<a href="${whatsappUrl}" target="_blank" class="apply-cta">💬 WhatsApp</a>`
      : job.phone
        ? `<a href="tel:${he(job.phone)}" class="apply-cta">📞 Call Now</a>`
        : `<a href="mailto:${he(job.email)}" class="apply-cta">✉️ Email</a>`}
</div>` : ''}

<footer>© ${new Date().getFullYear()} ${he(siteName)}. All rights reserved.</footer>

<script>
  (function() {
    const slug = '${job.slug}';
    fetch('/api/jobs/' + slug)
      .then(() => console.log('View counted'))
      .catch(e => console.error('View count error', e));
  })();
</script>

<!-- Apply Now Modal -->
<div class="seo-apply-overlay" id="seoApplyOverlay">
  <div class="seo-apply-modal">
    <div class="seo-apply-header">
      <div>
        <h3>Apply for this Job</h3>
        <p style="margin:.2rem 0 0;font-size:.78rem;color:#6b7280">${he(job.title)} — ${he(job.company)}</p>
      </div>
      <button onclick="closeSeoApply()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#6b7280">✕</button>
    </div>
    <div class="seo-apply-body">
      <div id="seoApplyMsg"></div>
      <div id="seoScreeningWrap" style="display:none;margin-bottom:1rem">
        <div style="font-size:.75rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.65rem">Pre-Screening Questions</div>
        <div id="seoScreeningFields"></div>
        <hr style="border-color:#e5e7eb;margin:.75rem 0">
      </div>
      <div class="seo-field">
        <label class="seo-label">Full Name *</label>
        <input type="text" class="seo-input" id="seoName" placeholder="Your full name">
      </div>
      <div class="seo-row">
        <div class="seo-field">
          <label class="seo-label">Phone</label>
          <input type="tel" class="seo-input" id="seoPhone" placeholder="+966 5XX XXX XXX">
        </div>
        <div class="seo-field">
          <label class="seo-label">WhatsApp</label>
          <input type="tel" class="seo-input" id="seoWA" placeholder="+966 5XX XXX XXX">
        </div>
      </div>
      <div class="seo-field">
        <label class="seo-label">Email (for confirmation)</label>
        <input type="email" class="seo-input" id="seoEmail" placeholder="your@email.com">
      </div>
      <div class="seo-row" id="seoRowNatIqama" style="display:none">
        <div class="seo-field" id="seoColNat">
          <label class="seo-label">Nationality</label>
          <div class="cnt-picker">
            <input type="text" class="seo-input" id="seoNatSearch" placeholder="Search nationality..." oninput="filterCntSingle('seoNat',this.value)" onfocus="filterCntSingle('seoNat',this.value)" autocomplete="off">
            <div class="cnt-dropdown" id="seoNatDd"></div>
            <input type="hidden" id="seoNat">
          </div>
        </div>
        <div class="seo-field" id="seoColIqama">
          <label class="seo-label">Iqama Status</label>
          <select class="seo-input" id="seoIqama">
            <option value="">Select...</option>
            <option>Transferable</option>
            <option>Non-transferable</option>
            <option>Visit visa</option>
            <option>Outside Saudi</option>
            <option>Saudi National</option>
          </select>
        </div>
      </div>
      <div class="seo-row" id="seoRowExpCert" style="display:none">
        <div class="seo-field" id="seoColExp">
          <label class="seo-label">Experience (years)</label>
          <input type="number" class="seo-input" id="seoExp" placeholder="0" min="0">
        </div>
        <div class="seo-field" id="seoColCert">
          <label class="seo-label">Has Required Cert?</label>
          <select class="seo-input" id="seoCert">
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>
      </div>
      <div id="seoRowIqamaNum" style="display:none">
        <div class="seo-field">
          <label class="seo-label">Iqama Number</label>
          <input type="text" class="seo-input" id="seoIqamaNum" inputmode="numeric" placeholder="e.g. 2490123456">
        </div>
      </div>
      <div class="seo-field">
        <label class="seo-label">Cover Note (optional)</label>
        <textarea class="seo-input" id="seoCover" rows="3" placeholder="Briefly introduce yourself..."></textarea>
      </div>
      <div id="seoCvRow" style="display:none" class="seo-field">
        <label class="seo-label" id="seoCvLabel">CV / Resume (PDF)</label>
        <input type="file" id="seoCvFile" accept=".pdf" class="seo-input" style="cursor:pointer;padding:.45rem .65rem">
        <div style="font-size:.71rem;color:#6b7280;margin-top:.2rem">PDF only · Max 5MB</div>
      </div>
    </div>
    <div class="seo-apply-footer">
      <button class="seo-btn-secondary" onclick="closeSeoApply()">Cancel</button>
      <button class="seo-btn-primary" id="seoSubmitBtn" onclick="submitSeoApplication()">📩 Submit Application</button>
    </div>
  </div>
</div>

<script>
var SEO_JOB_ID = ${job.id};

async function openSeoApply() {
  var g = function(id){ return document.getElementById(id); };
  g('seoApplyMsg').innerHTML = '';
  g('seoSubmitBtn').disabled = false;
  g('seoSubmitBtn').textContent = '📩 Submit Application';
  var ns=g('seoNatSearch'); if(ns) ns.value='';
  var nh=g('seoNat'); if(nh) nh.value='';

  // Reset — hide all optional fields first
  ['seoRowNatIqama','seoRowExpCert','seoRowIqamaNum'].forEach(function(id){
    var el=g(id); if(el) el.style.display='none';
  });
  g('seoScreeningWrap').style.display='none';
  if(g('seoScreeningFields')) g('seoScreeningFields').innerHTML='';

  // Load screening and show only what employer enabled
  try {
    var resp = await fetch('/api/employer/screening/' + SEO_JOB_ID);
    var data = await resp.json();
    if (data.success) {
      var fl = data.filters || {};
      var sN = !!fl.nationalities, sI = !!fl.iqama_types;
      var sE = fl.min_experience > 0, sC = !!fl.required_certs;
      if(g('seoColNat'))       g('seoColNat').style.display       = sN ? '' : 'none';
      if(g('seoColIqama'))     g('seoColIqama').style.display     = sI ? '' : 'none';
      if(g('seoRowNatIqama'))  g('seoRowNatIqama').style.display  = (sN||sI) ? '' : 'none';
      if(g('seoColExp'))       g('seoColExp').style.display       = sE ? '' : 'none';
      if(g('seoColCert'))      g('seoColCert').style.display      = sC ? '' : 'none';
      if(g('seoRowExpCert'))   g('seoRowExpCert').style.display   = (sE||sC) ? '' : 'none';
      if(g('seoRowIqamaNum')) g('seoRowIqamaNum').style.display = fl.require_iqama_number ? '' : 'none';
      var requireCv = data.require_cv || 0;
      var cvRow = g('seoCvRow'); var cvLabel = g('seoCvLabel');
      if (cvRow) { cvRow.style.display = ''; cvRow.dataset = cvRow.dataset||{}; cvRow.setAttribute('data-required', requireCv?'1':'0'); }
      if (cvLabel) cvLabel.innerHTML = requireCv
        ? 'CV / Resume (PDF) <span style="color:#dc2626">*</span>'
        : 'CV / Resume (PDF) <span style="font-size:.71rem;color:#6b7280">(optional)</span>';
      if (data.questions && data.questions.length) {
        var fields = g('seoScreeningFields');
        fields.innerHTML = data.questions.map(function(q, i) {
          return '<div style="margin-bottom:.65rem"><label style="font-size:.82rem;font-weight:600;color:#161616;display:block;margin-bottom:.25rem">' + (i+1) + '. ' + q.text + '</label>'
            + (q.type === 'yesno'
              ? '<select class="seo-input screening-ans" data-q="'+i+'"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select>'
              : '<input type="text" class="seo-input screening-ans" data-q="'+i+'" placeholder="Your answer...">')
            + '</div>';
        }).join('');
        g('seoScreeningWrap').style.display = 'block';
      }
    }
  } catch(e) {}
  g('seoApplyOverlay').classList.add('open');
}

function closeSeoApply() {
  document.getElementById('seoApplyOverlay').classList.remove('open');
}

async function submitSeoApplication() {
  var name  = document.getElementById('seoName').value.trim();
  var phone = document.getElementById('seoPhone').value.trim();
  var wa    = document.getElementById('seoWA').value.trim();
  var msgEl = document.getElementById('seoApplyMsg');

  if (!name)         { showSeoMsg('Full name is required', 'error'); return; }
  if (!phone && !wa) { showSeoMsg('Phone or WhatsApp is required', 'error'); return; }

  var email = document.getElementById('seoEmail').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSeoMsg('Please enter a valid email address', 'error');
    return;
  }

  var answers = [];
  document.querySelectorAll('.screening-ans').forEach(function(el) {
    answers.push({ q: parseInt(el.dataset.q), answer: el.value.trim() });
  });

  var btn = document.getElementById('seoSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  var cvFile = document.getElementById('seoCvFile') ? document.getElementById('seoCvFile').files[0] : null;
  var cvRequired = document.getElementById('seoCvRow') && document.getElementById('seoCvRow').getAttribute('data-required') === '1';
  if (cvRequired && !cvFile) { showSeoMsg('Please upload your CV (PDF, max 5MB)', 'error'); return; }
  if (cvFile && cvFile.size > 5*1024*1024) { showSeoMsg('CV too large — max 5MB', 'error'); return; }

  var fd = new FormData();
  fd.append('full_name',        name);
  fd.append('email',            document.getElementById('seoEmail').value.trim() || '');
  fd.append('phone',            phone || '');
  fd.append('whatsapp',         wa || '');
  fd.append('nationality',      document.getElementById('seoNat').value.trim() || '');
  fd.append('iqama_status',     document.getElementById('seoIqama').value || '');
  fd.append('experience_years', document.getElementById('seoExp').value || '');
  fd.append('has_certificate',  document.getElementById('seoCert').value === '1' ? '1' : '0');
  fd.append('iqama_number',     document.getElementById('seoIqamaNum') ? document.getElementById('seoIqamaNum').value.trim() : '');
  fd.append('cover_note',       document.getElementById('seoCover').value.trim() || '');
  fd.append('screening_answers', JSON.stringify(answers));
  if (cvFile) fd.append('cv', cvFile);

  try {
    var resp = await fetch('/api/employer/apply/' + SEO_JOB_ID, {
      method: 'POST',
      body: fd
    });
    var result = await resp.json();
    if (result.success) {
      showSeoMsg('✅ Application submitted! The employer will contact you.', 'success');
      btn.textContent = '✅ Submitted';
    } else {
      showSeoMsg(result.message || 'Failed to submit.', 'error');
      btn.disabled = false;
      btn.textContent = '📩 Submit Application';
    }
  } catch(e) {
    showSeoMsg('Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = '📩 Submit Application';
  }
}

function showSeoMsg(text, type) {
  var el = document.getElementById('seoApplyMsg');
  el.innerHTML = '<div class="seo-msg" style="background:'
    + (type==='success' ? 'rgba(16,185,129,.1);color:#059669;border:1px solid rgba(16,185,129,.2)' : 'rgba(239,68,68,.08);color:#dc2626;border:1px solid rgba(239,68,68,.2)')
    + '">' + text + '</div>';
}
</script>
<script src="/js/countries.js"></script>

</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (err) {
    console.error('SSR job page error:', err);
    next(); // fallback to SPA
  }
});

module.exports = router;

/* ══════════════════════════════════════════════════════════════
   SEO LANDING PAGES  /aramco-jobs, /hse-jobs, etc.
══════════════════════════════════════════════════════════════ */
const LANDING_PAGES = {
  'aramco-jobs': {
    title: 'Aramco Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'Aramco Jobs in Saudi Arabia',
    desc: 'Browse latest Saudi Aramco job vacancies. HSE, QC, engineers, supervisors, WPR jobs for Aramco projects. Apply directly via WhatsApp.',
    keywords: 'aramco jobs, saudi aramco jobs, aramco careers, aramco project jobs, aramco wpr jobs',
    search: ['aramco', 'saudi aramco'], exclude: ['non aramco', 'non-aramco']
  },
  'hse-jobs': {
    title: 'HSE Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'HSE Jobs in Saudi Arabia & Gulf',
    desc: 'Latest HSE Officer, HSE Supervisor, Safety Officer jobs in Saudi Arabia. Jubail, Riyadh, Dammam. Apply directly with recruiters.',
    keywords: 'HSE jobs saudi arabia, safety officer jobs, HSE officer jobs jubail, safety jobs gulf',
    search: ['hse', 'safety officer', 'safety supervisor', 'safety engineer', 'fire watcher']
  },
  'qc-jobs': {
    title: 'QC Inspector Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'QC Inspector Jobs in Saudi Arabia',
    desc: 'Browse QC Inspector, QA/QC Engineer, Quality Control jobs in Saudi Arabia. Jubail, Yanbu, Dammam. Direct contact with recruiters.',
    keywords: 'QC inspector jobs saudi arabia, QA QC jobs, quality control jobs jubail, QC engineer jobs',
    search: ['qc inspector', 'qa/qc', 'quality control', 'quality inspector', 'qc supervisor']
  },
  'wpr-jobs': {
    title: 'WPR Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'Work Permit Receiver (WPR) Jobs in Saudi Arabia',
    desc: 'Latest WPR jobs in Saudi Arabia. Work Permit Receiver vacancies in Jubail, Riyadh, Dammam. Aramco WPR, non-Aramco WPR jobs.',
    keywords: 'WPR jobs, work permit receiver jobs, wpr jobs jubail, aramco wpr jobs, non aramco wpr jobs',
    search: ['wpr', 'work permit receiver', 'permit receiver']
  },
  'shutdown-jobs': {
    title: 'Shutdown Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'Shutdown & Turnaround Jobs in Saudi Arabia',
    desc: 'Latest shutdown and turnaround jobs in Jubail, Yanbu, Ras Tanura. Short-term project jobs for skilled workers. Apply directly.',
    keywords: 'shutdown jobs saudi arabia, turnaround jobs jubail, shutdown jobs yanbu, refinery shutdown jobs',
    search: ['shutdown', 'turnaround', 'tat jobs', 'maintenance shutdown']
  },
  'neom-jobs': {
    title: 'NEOM Jobs 2026 | JobOrbit',
    h1: 'NEOM Project Jobs in Saudi Arabia',
    desc: 'Browse latest NEOM jobs 2026. Engineers, construction, HSE, supervisors for NEOM giga projects. Apply directly with recruiters.',
    keywords: 'NEOM jobs 2026, NEOM careers, NEOM project jobs, jobs in NEOM saudi arabia',
    search: ['neom', 'the line', 'neom project']
  },
  'oil-gas-jobs': {
    title: 'Oil & Gas Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'Oil & Gas Jobs in Saudi Arabia & Gulf',
    desc: 'Latest oil and gas jobs in Saudi Arabia. Aramco, SABIC, YASREF projects. Engineers, technicians, operators. Apply directly.',
    keywords: 'oil gas jobs saudi arabia, petroleum jobs, refinery jobs saudi, oil field jobs gulf',
    search: ['oil', 'gas', 'petroleum', 'refinery', 'upstream', 'downstream', 'pipeline']
  },
  'jubail-jobs': {
    title: 'Jobs in Jubail 2026 | JobOrbit',
    h1: 'Jobs in Jubail Industrial City',
    desc: 'Latest job vacancies in Jubail Industrial City. Construction, HSE, QC, welders, riggers, supervisors. Direct contact with recruiters.',
    keywords: 'jobs in jubail, jubail industrial city jobs, jubail vacancies, jobs jubail expatriates',
    search: ['jubail']
  },
  'dammam-jobs': {
    title: 'Jobs in Dammam 2026 | JobOrbit',
    h1: 'Jobs in Dammam, Saudi Arabia',
    desc: 'Latest job vacancies in Dammam. Construction, industrial, engineering jobs. Direct contact with recruiters via WhatsApp.',
    keywords: 'jobs in dammam, dammam vacancies, urgent jobs dammam, dammam saudi jobs 2026',
    search: ['dammam']
  },
  'riyadh-jobs': {
    title: 'Jobs in Riyadh 2026 | JobOrbit',
    h1: 'Jobs in Riyadh, Saudi Arabia',
    desc: 'Latest job vacancies in Riyadh 2026. Engineering, construction, HSE, technical jobs. Direct contact with recruiters.',
    keywords: 'jobs in riyadh, riyadh vacancies, riyadh jobs 2026, jobs riyadh saudi arabia',
    search: ['riyadh']
  },
  'transferable-iqama-jobs': {
    title: 'Transferable Iqama Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'Transferable Iqama Jobs in Saudi Arabia',
    desc: 'Jobs for candidates with transferable iqama in Saudi Arabia. Immediate joining, local hiring. Jubail, Riyadh, Dammam.',
    keywords: 'transferable iqama jobs, iqama transfer jobs saudi, local hiring saudi arabia, immediate joining jobs',
    search: ['transferable', 'iqama transfer', 'local hire', 'immediate joining']
  },
  'mep-jobs': {
    title: 'MEP Jobs in Saudi Arabia 2026 | JobOrbit',
    h1: 'MEP Jobs in Saudi Arabia & Gulf',
    desc: 'Latest MEP jobs in Saudi Arabia. Mechanical, Electrical, Plumbing engineers and technicians. Riyadh, Jeddah, Dammam.',
    keywords: 'MEP jobs saudi arabia, mechanical electrical plumbing jobs, MEP engineer jobs, MEP technician jobs',
    search: ['mep', 'mechanical electrical', 'plumbing', 'hvac', 'electrical technician']
  }
};

const PAGE_FAQS = {
  "aramco-jobs": [
    { q: "How to apply for Aramco jobs?", a: "Browse Aramco job listings on JobOrbit and contact recruiters directly via WhatsApp or phone. No middlemen." },
    { q: "What qualifications are needed for Aramco jobs?", a: "Aramco jobs require relevant technical certifications, experience in oil and gas, and often ARAMCO approval for roles like HSE and QC." },
    { q: "Are there WPR jobs available in Aramco projects?", a: "Yes, Work Permit Receiver (WPR) jobs are frequently available in Aramco projects in Jubail, Yanbu and Ras Tanura." }
  ],
  "hse-jobs": [
    { q: "What certifications are needed for HSE jobs in Saudi Arabia?", a: "Common certifications include NEBOSH, IOSH, OSHA, and first aid. Aramco projects often require additional safety training." },
    { q: "What is the salary for HSE Officer jobs in Saudi Arabia?", a: "HSE Officer salaries in Saudi Arabia typically range from SAR 5,000 to SAR 15,000 depending on experience and project type." },
    { q: "Are there fire watcher jobs available in Saudi Arabia?", a: "Yes, fire watcher positions are regularly available in industrial projects in Jubail, Yanbu and Dammam." }
  ],
  "qc-jobs": [
    { q: "What qualifications are needed for QC Inspector jobs?", a: "QC Inspector roles typically require relevant technical certification, inspection experience, and knowledge of international standards like AWS, ASME, or ISO." },
    { q: "What is the average salary for QC Inspector in Saudi Arabia?", a: "QC Inspector salaries in Saudi Arabia range from SAR 4,000 to SAR 12,000 depending on specialization and experience." },
    { q: "What are the most in-demand QC jobs in Saudi Arabia?", a: "The most in-demand QC roles include Welding Inspector, Coating Inspector, Mechanical QC Inspector, and NDT Technician." }
  ],
  "wpr-jobs": [
    { q: "What is a Work Permit Receiver (WPR)?", a: "A WPR is responsible for receiving and managing work permits in industrial facilities. They ensure all safety requirements are met before work begins." },
    { q: "What qualifications are needed for WPR jobs?", a: "WPR jobs require safety training, knowledge of permit-to-work systems, and often Aramco or company-specific certification." },
    { q: "Where are most WPR jobs located in Saudi Arabia?", a: "Most WPR jobs are in Jubail Industrial City, Yanbu, Ras Tanura, and Dhahran where major oil and gas facilities are located." }
  ],
  "shutdown-jobs": [
    { q: "What are shutdown jobs in Saudi Arabia?", a: "Shutdown jobs are temporary positions during planned maintenance or turnaround of industrial facilities. They usually last 2-8 weeks with higher pay rates." },
    { q: "Which cities have the most shutdown jobs in Saudi Arabia?", a: "Jubail, Yanbu, Ras Tanura, and Dammam are the main locations for shutdown and turnaround jobs in Saudi Arabia." },
    { q: "How do I find shutdown jobs in Saudi Arabia?", a: "Browse JobOrbit daily for new shutdown job listings. Shutdown jobs are posted frequently especially before major plant turnarounds." }
  ],
  "jubail-jobs": [
    { q: "What types of jobs are available in Jubail?", a: "Jubail Industrial City has many construction, HSE, QC, welding, rigging, instrumentation, and maintenance jobs." },
    { q: "How can expatriates find jobs in Jubail?", a: "Expatriates can browse JobOrbit for Jubail job listings and contact recruiters directly. Many positions offer visa sponsorship." },
    { q: "What is the average salary in Jubail Industrial City?", a: "Salaries in Jubail vary by role. Technical workers earn SAR 3,000-8,000, while engineers and supervisors earn SAR 8,000-20,000." }
  ],
  "transferable-iqama-jobs": [
    { q: "What is a transferable iqama in Saudi Arabia?", a: "A transferable iqama allows expatriates to change employers without their current sponsor permission, giving more job flexibility." },
    { q: "How do I find jobs for transferable iqama holders?", a: "Browse JobOrbit for local hiring jobs in Saudi Arabia that accept candidates with transferable iqama for immediate joining." },
    { q: "What are the benefits of having a transferable iqama?", a: "With a transferable iqama you can join a new employer faster, negotiate better salary, and apply for local hire positions." }
  ]
};
router.get('/:slug(aramco-jobs|hse-jobs|qc-jobs|wpr-jobs|shutdown-jobs|neom-jobs|oil-gas-jobs|jubail-jobs|dammam-jobs|riyadh-jobs|transferable-iqama-jobs|mep-jobs)', async (req, res) => {
  try {
    const page = LANDING_PAGES[req.params.slug];
    if (!page) return res.status(404).send('Not found');

    const siteUrl  = await getSiteUrl();
    const siteName = await getSiteName();
    const canonical = `${siteUrl}/${req.params.slug}`;

    // Build search query for all terms
    const orClauses = page.search.map(() => 'j.title LIKE ? OR j.description LIKE ?').join(' OR ');
    const params = [];
    const excludeClauses = (page.exclude||[]).map(() => "j.title NOT LIKE ? AND j.title NOT LIKE ?").join(" AND ");
    const excludeSql = excludeClauses ? "AND " + excludeClauses : "";
    page.search.forEach(t => { params.push(`%${t}%`, `%${t}%`); });
    (page.exclude||[]).forEach(t => { params.push(`%${t}%`, `%${t}%`); });

    const [jobs] = await db.query(
      `SELECT j.id, j.title, j.company, j.location, j.job_type, j.slug, j.created_at, c.name AS category
         FROM jobs j JOIN categories c ON j.category_id = c.id
        WHERE j.status = 'active' AND (${orClauses}) ${excludeSql}
        ORDER BY j.created_at DESC LIMIT 30`,
      params
    );

    const jobListHtml = jobs.length === 0
      ? '<p style="color:#64748b;text-align:center;padding:2rem">No jobs found currently. Check back daily — we update jobs every 24 hours.</p>'
      : jobs.map(j => `
        <a href="${siteUrl}/job/${xe(j.slug)}" class="job-card">
          <div class="job-title">${he(j.title)}</div>
          <div class="job-meta">
            <span>🏢 ${he(j.company)}</span>
            <span>📍 ${he(j.location)}</span>
            <span>💼 ${he(j.job_type || 'Full-time')}</span>
          </div>
          <div class="job-cat">${he(j.category)}</div>
        </a>`).join('');

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: page.title,
      description: page.desc,
      url: canonical,
      publisher: { '@type': 'Organization', name: siteName, url: siteUrl }
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${he(page.title)}</title>
  <meta name="description" content="${he(page.desc)}">
  <meta name="keywords" content="${he(page.keywords)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${he(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${he(page.title)}">
  <meta property="og:description" content="${he(page.desc)}">
  <meta property="og:url" content="${he(canonical)}">
  <meta property="og:site_name" content="${he(siteName)}">
  <meta property="og:image" content="${he(siteUrl)}/JobOrbitFavicon.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${he(page.title)}">
  <meta name="twitter:description" content="${he(page.desc)}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  ${PAGE_FAQS[req.params.slug] ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: PAGE_FAQS[req.params.slug].map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) })}</script>` : ""}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#161616;line-height:1.65}
    a{color:#0f62fe;text-decoration:none}
    nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem;position:sticky;top:0;z-index:100}
    nav a{font-weight:700;color:#0f62fe;font-size:1rem}
    .wrap{max-width:860px;margin:0 auto;padding:2rem 1.25rem}
    .hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#fff;padding:3rem 1.25rem;text-align:center;margin-bottom:2rem}
    .hero h1{font-size:clamp(1.5rem,4vw,2.2rem);font-weight:800;margin-bottom:.75rem}
    .hero p{font-size:1rem;color:rgba(255,255,255,.75);max-width:560px;margin:0 auto 1.5rem}
    .hero-stats{display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap}
    .stat{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:.5rem 1.25rem;font-size:.85rem}
    .stat strong{display:block;font-size:1.3rem;font-weight:800}
    .bc{font-size:.82rem;color:#6b7280;margin-bottom:1.5rem;display:flex;flex-wrap:wrap;gap:.3rem}
    .bc a{color:#0f62fe}
    .jobs-grid{display:flex;flex-direction:column;gap:.85rem;margin-bottom:2rem}
    .job-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.1rem 1.25rem;display:block;transition:border-color .15s,box-shadow .15s}
    .job-card:hover{border-color:#0f62fe;box-shadow:0 4px 16px rgba(15,98,254,.1)}
    .job-title{font-weight:700;font-size:.95rem;color:#0f172a;margin-bottom:.5rem}
    .job-meta{display:flex;flex-wrap:wrap;gap:.5rem;font-size:.78rem;color:#64748b;margin-bottom:.35rem}
    .job-cat{display:inline-block;background:#e8f0fe;color:#1a56db;border-radius:100px;padding:.15rem .65rem;font-size:.72rem;font-weight:600}
    .cta-box{background:#0f62fe;color:#fff;border-radius:14px;padding:1.75rem;text-align:center;margin:2rem 0}
    .cta-box h3{font-size:1.1rem;font-weight:700;margin-bottom:.5rem}
    .cta-box p{font-size:.88rem;opacity:.85;margin-bottom:1rem}
    .cta-btn{display:inline-block;background:#fff;color:#0f62fe;font-weight:700;padding:.65rem 1.75rem;border-radius:9px;font-size:.9rem}
    .related{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.65rem;margin-top:1.5rem}
    .rel-link{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:.75rem 1rem;font-size:.85rem;font-weight:600;color:#0f62fe;display:block;text-align:center}
    .rel-link:hover{background:#e8f0fe}
    footer{margin-top:3rem;padding:1.5rem;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
    @media(max-width:600px){.hero{padding:2rem 1rem}.stat{padding:.4rem 1rem}}
  </style>
</head>
<body>
<nav>
  <a href="/">${he(siteName)}</a>
  <span style="color:#9ca3af;font-size:.85rem">/ ${he(page.h1)}</span>
</nav>

<div class="hero">
  <h1>${he(page.h1)}</h1>
  <p>${he(page.desc)}</p>
  <div class="hero-stats">
    <div class="stat"><strong>${jobs.length}+</strong>Jobs Found</div>
    <div class="stat"><strong>Daily</strong>Updated</div>
    <div class="stat"><strong>Direct</strong>Apply</div>
  </div>
</div>

<div class="wrap">
  <nav class="bc" aria-label="Breadcrumb">
    <a href="/">Home</a> › <a href="/">Jobs</a> › <span>${he(page.h1)}</span>
  </nav>

  <div class="jobs-grid">${jobListHtml}</div>

  <div class="cta-box">
    <h3>🔔 Get Daily Job Alerts</h3>
    <p>New ${he(page.h1)} posted every day. Get them delivered to your inbox free.</p>
    <a href="/" class="cta-btn">Browse All Jobs →</a>
  </div>

  <h2 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:1rem">Browse Related Job Categories</h2>
  <div class="related">
    <a href="${siteUrl}/aramco-jobs" class="rel-link">Aramco Jobs</a>
    <a href="${siteUrl}/hse-jobs" class="rel-link">HSE Jobs</a>
    <a href="${siteUrl}/qc-jobs" class="rel-link">QC Inspector Jobs</a>
    <a href="${siteUrl}/wpr-jobs" class="rel-link">WPR Jobs</a>
    <a href="${siteUrl}/shutdown-jobs" class="rel-link">Shutdown Jobs</a>
    <a href="${siteUrl}/jubail-jobs" class="rel-link">Jubail Jobs</a>
    <a href="${siteUrl}/dammam-jobs" class="rel-link">Dammam Jobs</a>
    <a href="${siteUrl}/riyadh-jobs" class="rel-link">Riyadh Jobs</a>
    <a href="${siteUrl}/transferable-iqama-jobs" class="rel-link">Transferable Iqama</a>
    <a href="${siteUrl}/oil-gas-jobs" class="rel-link">Oil & Gas Jobs</a>
    <a href="${siteUrl}/neom-jobs" class="rel-link">NEOM Jobs</a>
    <a href="${siteUrl}/mep-jobs" class="rel-link">MEP Jobs</a>
  </div>
</div>

  ${(PAGE_FAQS[req.params.slug]||[]).length ? `<div style="max-width:860px;margin:0 auto;padding:0 1.25rem 2rem"><h2 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:1rem">Frequently Asked Questions</h2>${(PAGE_FAQS[req.params.slug]||[]).map(f=>"<div style=\"background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1rem 1.25rem;margin-bottom:.65rem\"><div style=\"font-weight:700;font-size:.9rem;color:#0f172a;margin-bottom:.35rem\">" + f.q + "</div><div style=\"font-size:.85rem;color:#64748b\">" + f.a + "</div></div>").join("")}</div>` : ""}
<footer>© ${new Date().getFullYear()} ${he(siteName)}. All rights reserved. | <a href="/">Browse All Jobs</a></footer>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (err) {
    console.error('Landing page error:', err);
    res.status(500).send('Server error');
  }
});
