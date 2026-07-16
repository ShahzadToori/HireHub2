'use strict';
/* Public ad-placement feed — powers the ad zones on the public site.
   Only enabled zones are returned; the admin-authored ad_code is trusted
   content (same trust level as GA4/meta injection), sent as-is for the
   client to drop straight into the zone's container. */
const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT zone, ad_code FROM ad_placements WHERE enabled = 1');
    const ads = {};
    rows.forEach(r => { ads[r.zone] = r.ad_code; });
    res.json({ success: true, ads });
  } catch (err) {
    console.error('[ads]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
