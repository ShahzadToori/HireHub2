'use strict';
const crypto = require('crypto');

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|googlebot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|yandexbot|discordbot|linkedinbot|embedly|quora link preview|pinterest|headlesschrome|phantomjs|curl|wget|python-requests|axios\/|node-fetch/i;

function isBot(ua) {
  if (!ua) return true; // no UA at all — treat as non-browser traffic
  return BOT_RE.test(ua);
}

function parseUserAgent(ua) {
  ua = ua || '';

  let device_type = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) device_type = 'tablet';
  else if (/mobile|iphone|ipod|android/i.test(ua)) device_type = 'mobile';

  let browser = 'Other';
  if (/edg\//i.test(ua))            browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua))    browser = 'Chrome';
  else if (/firefox\//i.test(ua))   browser = 'Firefox';
  else if (/safari\//i.test(ua))    browser = 'Safari';

  let os = 'Other';
  if (/windows/i.test(ua))       os = 'Windows';
  else if (/android/i.test(ua))  os = 'Android';
  else if (/iphone|ipad|ipod|ios/i.test(ua)) os = 'iOS';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua))    os = 'Linux';

  return { device_type, browser, os };
}

// Rotates daily so no cross-day visitor identifier is ever stored — the
// hash can only ever be used to dedupe "was this the same visitor today".
function visitorHash(ip, ua, salt) {
  const today = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256')
    .update(`${ip || ''}|${ua || ''}|${today}|${salt || ''}`)
    .digest('hex');
}

module.exports = { isBot, parseUserAgent, visitorHash };
