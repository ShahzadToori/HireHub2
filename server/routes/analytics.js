'use strict';
/* Public analytics collector — pageview + event beacons.
   No auth (called from every page load), validated + bot-filtered,
   sits behind the existing global rate limiter (app.use('/api/', globalLimiter)). */
const express = require('express');
const db      = require('../db/connection');
const { validate, z } = require('../middleware/validate');
const { isBot, parseUserAgent, visitorHash } = require('../utils/analyticsHelpers');
const router  = express.Router();

const EVENT_NAMES = [
  'job_view',
  'job_apply_submitted',
  'search_performed',
  'job_alert_subscribed',
  'employer_registered',
  'job_posted'
];

const pageviewSchema = z.object({
  path:            z.string().trim().min(1).max(500),
  referrer_domain: z.string().trim().max(255).optional().or(z.literal('')),
  session_id:      z.string().trim().min(1).max(64)
}).strict();

const eventSchema = z.object({
  session_id: z.string().trim().min(1).max(64),
  event_name: z.enum(EVENT_NAMES),
  event_data: z.record(z.any()).optional(),
  path:       z.string().trim().max(500).optional().or(z.literal(''))
}).strict().refine(
  data => !data.event_data || JSON.stringify(data.event_data).length <= 2000,
  { message: 'event_data too large', path: ['event_data'] }
);

router.post('/pageview', validate(pageviewSchema), async (req, res) => {
  try {
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return res.status(204).end();

    const { path, referrer_domain, session_id } = req.body;
    const { device_type, browser, os } = parseUserAgent(ua);
    const vHash = visitorHash(req.ip, ua, process.env.SESSION_SECRET);

    await db.query(
      `INSERT INTO analytics_pageviews
         (path, referrer_domain, session_id, visitor_hash, device_type, browser, os)
       VALUES (?,?,?,?,?,?,?)`,
      [path, referrer_domain || null, session_id, vHash, device_type, browser, os]
    );
    res.status(204).end();
  } catch (err) {
    console.error('[analytics pageview]', err);
    res.status(204).end(); // never surface tracking errors to the client
  }
});

router.post('/event', validate(eventSchema), async (req, res) => {
  try {
    const { session_id, event_name, event_data, path } = req.body;
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return res.status(204).end();

    await db.query(
      `INSERT INTO analytics_events (session_id, event_name, event_data, path)
       VALUES (?,?,?,?)`,
      [session_id, event_name, event_data ? JSON.stringify(event_data) : null, path || null]
    );
    res.status(204).end();
  } catch (err) {
    console.error('[analytics event]', err);
    res.status(204).end();
  }
});

module.exports = router;
