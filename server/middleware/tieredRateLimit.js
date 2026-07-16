'use strict';
/* ══════════════════════════════════════════════════════════════
   Tiered per-IP rate limits, all thresholds configurable via env
   vars (nothing hardcoded). Three tiers:
     - global:        safety-net baseline applied to all /api/*
     - publicForm:     stricter tier stacked on top for public,
                       unauthenticated content-submission endpoints
                       (job submit, apply, contact, blacklist report)
     - authenticated:  looser tier for routes gated behind an
                       existing login (admin/employer session)

   Login/register/password-reset routes are NOT handled here — they
   use the per-IP + per-account exponential-backoff limiter in
   authRateLimit.js instead, since a fixed window doesn't fit
   "reject or slow down repeated guesses" well.
══════════════════════════════════════════════════════════════ */
const rateLimit = require('express-rate-limit');

function makeLimiter(envPrefix, defaultWindowMs, defaultMax) {
  return rateLimit({
    windowMs: parseInt(process.env[`${envPrefix}_WINDOW_MS`]) || defaultWindowMs,
    max:      parseInt(process.env[`${envPrefix}_MAX`])       || defaultMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' }
  });
}

const globalLimiter        = makeLimiter('RATE_LIMIT_GLOBAL',        15 * 60 * 1000, 200);
const publicFormLimiter    = makeLimiter('RATE_LIMIT_PUBLIC_FORM',    15 * 60 * 1000, 20);
const authenticatedLimiter = makeLimiter('RATE_LIMIT_AUTHENTICATED', 15 * 60 * 1000, 600);

module.exports = { globalLimiter, publicFormLimiter, authenticatedLimiter };
