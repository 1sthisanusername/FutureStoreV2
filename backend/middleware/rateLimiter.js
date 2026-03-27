// middleware/rateLimiter.js
// ─────────────────────────────────────────────────────────────────
// Granular rate limits per endpoint category.
// Add  "xss": "^1.0.14", "hpp": "^0.2.3"  to package.json deps.
// ─────────────────────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
    legacyHeaders:   false,   // Disable `X-RateLimit-*` headers
    message: { success: false, message },
    // Use IP + user-agent as key so shared IPs (NAT) aren't over-penalised
    keyGenerator: (req) =>
      (req.ip || req.connection.remoteAddress) + ':' + (req.headers['user-agent'] || ''),
    handler: (req, res, next, options) => {
      console.warn(`[RATE_LIMIT] ${options.keyGenerator(req)} → ${req.path}`);
      res.status(429).json(options.message);
    },
    skip: (req) => process.env.NODE_ENV === 'test', // never block test suite
  });

module.exports = {
  // ── Auth routes — tightest ──────────────────────────────────────
  authLimiter:     make(15 * 60 * 1000,  1000,  'Too many auth attempts. Try again in 15 minutes.'),

  // ── Password reset / OTP — very tight ──────────────────────────
  resetLimiter:    make(60 * 60 * 1000,   5,  'Too many reset requests. Try again in 1 hour.'),
  otpLimiter:      make(10 * 60 * 1000,   5,  'Too many OTP requests. Try again in 10 minutes.'),

  // ── Search / suggest — generous but bot-proof ──────────────────
  searchLimiter:   make(60 * 1000,        60,  'Too many search requests. Slow down.'),

  // ── Email subscribe — spam prevention ──────────────────────────
  subscribeLimiter:make(60 * 60 * 1000,   5,  'Too many subscription attempts. Try again in 1 hour.'),

  // ── Coupon validation — prevent brute-force code guessing ──────
  couponLimiter:   make(60 * 1000,        10,  'Too many coupon attempts. Try again in a minute.'),

  // ── Order placement — prevent duplicate submissions ─────────────
  orderLimiter:    make(60 * 1000,        5,   'Too many order requests. Please wait a moment.'),

  // ── Admin write operations ──────────────────────────────────────
  adminWriteLimiter: make(60 * 1000,      30,  'Too many admin requests. Slow down.'),

  // ── General API fallback ────────────────────────────────────────
  apiLimiter:      make(60 * 1000,        120, 'Too many requests. Please slow down.'),
};
