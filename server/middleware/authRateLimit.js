'use strict';
/* ══════════════════════════════════════════════════════════════
   Per-IP AND per-account rate limiting with exponential backoff,
   for authentication-adjacent routes (login, register, password
   reset). Backed by MySQL (not in-memory) so limits are enforced
   correctly across the VPS's PM2 cluster workers, not per-process.

   Behavior: the first N attempts (ATTEMPT-LIMIT.FREE_ATTEMPTS) are
   free of any delay — this avoids punishing normal typos. Each
   failure after that doubles the required wait before the next
   attempt for that key, capped at MAX_DELAY_MS, rather than a hard
   lockout that fully blocks the account/IP for a fixed window.

   All thresholds are configurable via env vars (see below) —
   nothing here is hardcoded.
══════════════════════════════════════════════════════════════ */
const db = require('../db/connection');

const BASE_DELAY_MS  = parseInt(process.env.AUTH_RATE_LIMIT_BASE_DELAY_MS)  || 1000;            // 1s
const MAX_DELAY_MS    = parseInt(process.env.AUTH_RATE_LIMIT_MAX_DELAY_MS)   || 15 * 60 * 1000;  // 15 min cap
const FREE_ATTEMPTS    = parseInt(process.env.AUTH_RATE_LIMIT_FREE_ATTEMPTS)  || 3;
const RESET_AFTER_MS  = parseInt(process.env.AUTH_RATE_LIMIT_RESET_AFTER_MS) || 24 * 60 * 60 * 1000; // stale entries treated as fresh

function computeDelayMs(attempts) {
  if (attempts <= FREE_ATTEMPTS) return 0;
  const n = attempts - FREE_ATTEMPTS;
  return Math.min(BASE_DELAY_MS * Math.pow(2, n - 1), MAX_DELAY_MS);
}

function humanize(sec) {
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'}`;
  const min = Math.ceil(sec / 60);
  return `${min} minute${min === 1 ? '' : 's'}`;
}

async function getState(key) {
  const [[row]] = await db.query('SELECT * FROM auth_rate_limits WHERE rate_key = ?', [key]);
  if (!row) return null;
  if (Date.now() - new Date(row.last_attempt_at).getTime() > RESET_AFTER_MS) return null; // stale
  return row;
}

async function recordFailure(key) {
  const row = await getState(key);
  const attempts = (row ? row.attempts : 0) + 1;
  const delay = computeDelayMs(attempts);
  const lockedUntil = delay > 0 ? new Date(Date.now() + delay) : null;
  const now = new Date();
  await db.query(
    `INSERT INTO auth_rate_limits (rate_key, attempts, first_attempt_at, last_attempt_at, locked_until)
     VALUES (?, 1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE attempts = ?, last_attempt_at = ?, locked_until = ?`,
    [key, now, now, lockedUntil, attempts, now, lockedUntil]
  );
}

async function recordSuccess(key) {
  await db.query('DELETE FROM auth_rate_limits WHERE rate_key = ?', [key]).catch(() => {});
}

function tooManyRequests(res, lockedUntil) {
  const retrySec = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
  res.setHeader('Retry-After', retrySec);
  return res.status(429).json({
    success: false,
    message: `Too many attempts. Please try again in ${humanize(retrySec)}.`
  });
}

/**
 * routeName: short identifier so different routes don't share a bucket
 *            (e.g. 'admin-login', 'employer-login')
 * accountKeyFn: optional (req) => string, extracts the account identifier
 *               (username/email) from the request to key the per-account
 *               limit. Omit for routes with no account concept.
 */
function authRateLimit(routeName, accountKeyFn) {
  return async (req, res, next) => {
    try {
      const ipKey = `ip:${routeName}:${req.ip}`;
      const account = accountKeyFn ? accountKeyFn(req) : null;
      const acctKey = account ? `acct:${routeName}:${String(account).trim().toLowerCase()}` : null;

      const ipState = await getState(ipKey);
      if (ipState && ipState.locked_until && new Date(ipState.locked_until) > new Date()) {
        return tooManyRequests(res, ipState.locked_until);
      }
      if (acctKey) {
        const acctState = await getState(acctKey);
        if (acctState && acctState.locked_until && new Date(acctState.locked_until) > new Date()) {
          return tooManyRequests(res, acctState.locked_until);
        }
      }

      req._rateLimitKeys = { ipKey, acctKey };
      next();
    } catch (e) {
      console.error('[authRateLimit]', e);
      next(); // fail open — a broken rate-limit store should never lock out real users
    }
  };
}

async function recordAuthFailure(req) {
  if (!req._rateLimitKeys) return;
  const { ipKey, acctKey } = req._rateLimitKeys;
  await recordFailure(ipKey).catch(() => {});
  if (acctKey) await recordFailure(acctKey).catch(() => {});
}

async function recordAuthSuccess(req) {
  if (!req._rateLimitKeys) return;
  const { ipKey, acctKey } = req._rateLimitKeys;
  await recordSuccess(ipKey);
  if (acctKey) await recordSuccess(acctKey);
}

module.exports = { authRateLimit, recordAuthFailure, recordAuthSuccess };
