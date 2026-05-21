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
    <loc>${siteUrl}/contact.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
      `SELECT j.title, j.company, j.location, j.slug, j.job_type, j.created_at
         FROM jobs j
         JOIN categories c ON j.category_id = c.id
        WHERE j.category_id = ? AND j.slug != ? AND j.status = 'active'
        ORDER BY j.created_at DESC
        LIMIT 4`,
      [job.category_id, job.slug]
    );
    const siteUrl  = await getSiteUrl();
    const siteName = await getSiteName();

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
const applyLinkBtn = job.apply_link ? `<a href="${he(job.apply_link)}" class="cbtn cbtn-applylink" target="_blank"><i>🔗</i> Apply Link</a>` : '';
const contactBtns = [
  job.phone    ? `<a href="tel:${he(job.phone)}"    class="cbtn cbtn-phone"><i>📞</i> ${he(job.phone)}</a>` : '',
  job.whatsapp ? `<a href="${whatsappUrl}" class="cbtn cbtn-wa" target="_blank"><i>💬</i> WhatsApp</a>` : '',
  job.email    ? `<a href="mailto:${he(job.email)}" class="cbtn cbtn-email"><i>✉️</i> ${he(job.email)}</a>` : '',
  job.map_link ? `<a href="${he(job.map_link)}"     class="cbtn cbtn-map" target="_blank"><i>📍</i> View Location</a>` : '',
  applyLinkBtn
].filter(Boolean).join('\n          ');

    // ── Full SSR HTML ──────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${he(job.title)} at ${he(job.company)} – ${he(siteName)}</title>
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
      window.location.replace('/job/${job.slug}');
    }
  </script>

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#161616;line-height:1.65}
    a{color:#0f62fe;text-decoration:none}
    a:hover{text-decoration:underline}
    .wrap{max-width:780px;margin:0 auto;padding:2rem 1.25rem}
    nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem}
    nav a{font-weight:600;color:#0f62fe;font-size:1rem}
    nav span{color:#6b7280;font-size:.85rem}
    .bc{font-size:.82rem;color:#6b7280;margin-bottom:1.5rem;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
    .bc a{color:#0f62fe}
    .bc span{color:#9ca3af}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    .card-head{padding:1.75rem 2rem 1.5rem;border-bottom:1px solid #f1f3f4}
    .card-body{padding:1.75rem 2rem}
    .badges{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.85rem}
    .badge{display:inline-block;padding:.22rem .7rem;border-radius:100px;font-size:.72rem;font-weight:600;letter-spacing:.3px}
    .b-cat{background:#e8f0fe;color:#1a56db}
    .b-type{background:transparent;color:#0f62fe;border:1px solid #0f62fe}
    .b-feat{background:#0f62fe;color:#fff}
    .b-spon{background:#ff6b35;color:#fff}
    h1{font-size:clamp(1.4rem,3vw,1.9rem);font-weight:800;color:#0f172a;margin-bottom:.5rem;line-height:1.2}
    .meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.85rem}
    .chip{display:inline-flex;align-items:center;gap:.3rem;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:100px;padding:.28rem .8rem;font-size:.8rem;color:#475569}
    .section-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:.85rem;padding-bottom:.5rem;border-bottom:1px solid #f1f3f4}
    .desc{font-size:.95rem;line-height:1.85;color:#334155;white-space:pre-line}
    .apply-head{font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:.35rem}
    .apply-sub{font-size:.875rem;color:#64748b;margin-bottom:1.1rem}
    .contact-row{display:flex;flex-wrap:wrap;gap:.65rem}
    .cbtn{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.25rem;border-radius:9px;font-weight:600;font-size:.875rem;text-decoration:none;transition:opacity .15s}
    .cbtn:hover{opacity:.85;text-decoration:none}
    .cbtn-phone{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
    .cbtn-wa{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
    .cbtn-email{background:#e8f0fe;color:#1a56db;border:1px solid #c7d7fb}
    .cbtn-map{background:#fff3e0;color:#c84b00;border:1px solid #ffcc80}
    .cbtn-applylink{background:#e8f0fe;color:#1a56db;border:1px solid #c7d7fb}
.cbtn-applylink:hover{background:#1a56db;color:#fff}
    .back{display:inline-flex;align-items:center;gap:.3rem;color:#0f62fe;font-size:.88rem;margin-bottom:1.5rem}
    .back:hover{text-decoration:underline}
    footer{margin-top:3rem;padding:1.5rem 1.25rem;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
    @media(max-width:600px){.card-head,.card-body{padding:1.25rem}}
  </style>
</head>
<body>

<nav>
  <a href="/">${he(siteName)}</a>
  <span>/</span>
  <span>${he(job.category)}</span>
</nav>

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
      <div class="badges">
        ${job.featured  == 1 ? '<span class="badge b-feat">⭐ Featured</span>' : ''}
        ${job.sponsored == 1 ? '<span class="badge b-spon">Sponsored</span>' : ''}
        <span class="badge b-cat">${he(job.category)}</span>
        <span class="badge b-type">${he(job.job_type || 'Full-time')}</span>
      </div>
      <h1>${he(job.title)}</h1>
      <div class="meta">
        <span class="chip">🏢 ${he(job.company)}</span>
        <span class="chip">📍 ${he(job.location)}</span>
        <span class="chip">💼 ${he(job.job_type || 'Full-time')}</span>
        <span class="chip">🗓 Posted ${datePosted}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="section-label">Job Description</div>
      <div class="desc">${he(job.description)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-body">
      <div class="apply-head">Apply Now</div>
      <div class="apply-sub">Contact ${he(job.company)} directly — no middlemen.</div>
      <div class="contact-row">
        ${contactBtns || '<p style="color:#9ca3af;font-size:.88rem">No contact info provided.</p>'}
      </div>
      <p style="margin-top:1.1rem;font-size:.78rem;color:#9ca3af">
        Or <a href="/">browse more jobs</a> on ${he(siteName)}
      </p>
    </div>
  </div>

  <!-- Phase 2: Similar Jobs -->
  ${simRows.length > 0 ? `
  <div style="margin-top:2rem">
    <h2 style="font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:2px solid #e5e7eb">
      Similar Jobs in ${he(job.category)}
    </h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem">
      ${simRows.map(j => `
      <a href="${siteUrl}/job/${xe(j.slug)}" style="display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;text-decoration:none;transition:border-color .15s">
        <div style="font-family:-apple-system,sans-serif;font-weight:700;font-size:.9rem;color:#0f172a;margin-bottom:.3rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${he(j.title)}</div>
        <div style="font-size:.78rem;color:#64748b;margin-bottom:.3rem">🏢 ${he(j.company)}</div>
        <div style="font-size:.75rem;color:#94a3b8">📍 ${he(j.location)} · ${he(j.job_type || 'Full-time')}</div>
      </a>`).join('')}
    </div>
  </div>` : ''}

  <!-- Phase 2: Report a Job link -->
  <p style="margin-top:2rem;text-align:center;font-size:.78rem;color:#9ca3af">
    ⚑ <a href="/feedback.html" style="color:#9ca3af">Report this listing</a> if it appears fake, expired, or inappropriate.
  </p>
</div>

<footer>© ${new Date().getFullYear()} ${he(siteName)}. All rights reserved.</footer>

<script>
  (function() {
    const slug = '${job.slug}';
    fetch('/api/jobs/' + slug)
      .then(() => console.log('View counted'))
      .catch(e => console.error('View count error', e));
  })();
</script>

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
