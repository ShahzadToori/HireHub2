'use strict';
/* Admin-facing analytics reads — powers admin/analytics.html. */
const express          = require('express');
const db                = require('../db/connection');
const { requireAdmin }  = require('../middleware/auth');
const router            = express.Router();

const RANGE_DAYS = { '7': 7, '30': 30, '90': 90 };

function rangeDays(req) {
  return RANGE_DAYS[req.query.range] || 7;
}

// Local-time Y-M-D formatting — mysql2 returns DATE columns as a JS Date at
// local midnight, so toISOString() (which converts to UTC) shifts the date
// backward a day for any timezone ahead of UTC. Format from local getters
// instead so this holds regardless of server timezone.
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const days = rangeDays(req);

    const [[{ pageviews_total }]] = await db.query(
      'SELECT COUNT(*) AS pageviews_total FROM analytics_pageviews WHERE created_at >= NOW() - INTERVAL ? DAY',
      [days]
    );
    const [[{ unique_visitors }]] = await db.query(
      'SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors FROM analytics_pageviews WHERE created_at >= NOW() - INTERVAL ? DAY',
      [days]
    );
    const [top_pages] = await db.query(
      `SELECT path, COUNT(*) AS views FROM analytics_pageviews
       WHERE created_at >= NOW() - INTERVAL ? DAY
       GROUP BY path ORDER BY views DESC LIMIT 10`,
      [days]
    );
    const [top_referrers] = await db.query(
      `SELECT referrer_domain, COUNT(*) AS count FROM analytics_pageviews
       WHERE created_at >= NOW() - INTERVAL ? DAY
         AND referrer_domain IS NOT NULL AND referrer_domain <> ''
       GROUP BY referrer_domain ORDER BY count DESC LIMIT 10`,
      [days]
    );
    const [device_breakdown] = await db.query(
      `SELECT device_type, COUNT(*) AS count FROM analytics_pageviews
       WHERE created_at >= NOW() - INTERVAL ? DAY
       GROUP BY device_type`,
      [days]
    );
    const [events_breakdown] = await db.query(
      `SELECT event_name, COUNT(*) AS count, COUNT(DISTINCT session_id) AS unique_sessions
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL ? DAY
       GROUP BY event_name ORDER BY count DESC`,
      [days]
    );

    res.json({
      success: true,
      pageviews_total,
      unique_visitors,
      avg_pageviews_per_visitor: unique_visitors ? +(pageviews_total / unique_visitors).toFixed(2) : 0,
      top_pages,
      top_referrers,
      device_breakdown,
      events_breakdown
    });
  } catch (err) {
    console.error('[admin-analytics summary]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/timeseries', requireAdmin, async (req, res) => {
  try {
    const days = rangeDays(req);
    const [rows] = await db.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS pageviews,
              COUNT(DISTINCT visitor_hash) AS unique_visitors
       FROM analytics_pageviews
       WHERE created_at >= NOW() - INTERVAL ? DAY
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [days]
    );

    // Fill in zero-count days so the chart doesn't skip gaps
    const byDate = {};
    rows.forEach(r => {
      const key = r.date instanceof Date ? localDateStr(r.date) : String(r.date).slice(0, 10);
      byDate[key] = { pageviews: r.pageviews, unique_visitors: r.unique_visitors };
    });
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      series.push({ date: key, ...(byDate[key] || { pageviews: 0, unique_visitors: 0 }) });
    }

    res.json({ success: true, series });
  } catch (err) {
    console.error('[admin-analytics timeseries]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
