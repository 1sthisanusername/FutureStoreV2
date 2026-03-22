// middleware/coverGate.js
// Strips cover_color from book objects for unauthenticated requests,
// replacing it with a neutral placeholder so guests cannot derive
// cover art from the API response even if they bypass the frontend.
const jwt = require('jsonwebtoken');

const PLACEHOLDER_COLOR = '#2C2C2C'; // neutral dark — matches blurred tint

const stripCovers = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(stripCovers);
  if (typeof obj === 'object') {
    const out = { ...obj };
    if ('cover_color' in out) out.cover_color = PLACEHOLDER_COLOR;
    if ('bg'          in out) out.bg          = PLACEHOLDER_COLOR;
    // Strip related books covers too
    if (Array.isArray(out.related)) out.related = out.related.map(stripCovers);
    return out;
  }
  return obj;
};

/**
 * Intercepts the JSON response and strips cover colours
 * when the request has no valid JWT (guest user).
 */
const coverGate = (req, res, next) => {
  // Check for a valid token — same logic as auth middleware but non-blocking
  const token =
    (req.headers.authorization || '').replace('Bearer ', '') ||
    req.cookies?.token;

  let isAuthenticated = false;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      isAuthenticated = true;
    } catch (_) {}
  }

  if (isAuthenticated) return next(); // logged-in users get full data

  // Guest — intercept res.json to strip covers
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (data?.success && data?.data) {
      data = { ...data, data: stripCovers(data.data) };
    }
    return originalJson(data);
  };

  next();
};

module.exports = coverGate;
