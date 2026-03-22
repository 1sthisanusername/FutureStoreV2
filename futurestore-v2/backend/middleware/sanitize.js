// middleware/sanitize.js
// ─────────────────────────────────────────────────────────────────
// Layers of input sanitisation applied globally and per-route:
//
//  1. sanitizeBody   — strips XSS from every string in req.body
//  2. sanitizeQuery  — cleans req.query strings
//  3. preventHpp     — removes duplicate query params (HPP attack)
//  4. sanitizeHtml   — escapes HTML entities in a single string
//  5. safeText       — strips ALL HTML tags from a string
// ─────────────────────────────────────────────────────────────────

// ── Tiny inline XSS escaper (no extra package needed) ─────────────
// Covers the six dangerous HTML characters. Applied recursively to
// nested objects and arrays so nested user data is also cleaned.
const HTML_ESCAPE = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#x27;', '/':'&#x2F;' };
const escapeHtml = (str) =>
  typeof str === 'string'
    ? str.replace(/[&<>"'/]/g, (c) => HTML_ESCAPE[c])
    : str;

const stripTags = (str) =>
  typeof str === 'string'
    ? str.replace(/<[^>]*>/g, '').trim()
    : str;

// Recursively walk any value (object, array, primitive)
const deepClean = (val, fn) => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return fn(val);
  if (Array.isArray(val))  return val.map((v) => deepClean(v, fn));
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = deepClean(val[k], fn);
    return out;
  }
  return val;
};

// ── Middleware: sanitize req.body ─────────────────────────────────
// Strips HTML tags from every string value. We strip rather than
// escape here because we want clean plain text in the DB; the API
// always returns JSON so re-escaping at render time is the
// responsibility of the frontend.
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = deepClean(req.body, stripTags);
  }
  next();
};

// ── Middleware: sanitize req.query ────────────────────────────────
const sanitizeQuery = (req, res, next) => {
  if (req.query) {
    for (const k of Object.keys(req.query)) {
      if (typeof req.query[k] === 'string') {
        req.query[k] = stripTags(req.query[k]).slice(0, 500); // hard length cap
      }
    }
  }
  next();
};

// ── Middleware: prevent HTTP Parameter Pollution ──────────────────
// If a param appears multiple times (e.g. ?sort=price&sort=rating),
// keep only the LAST value to prevent logic confusion.
const preventHpp = (req, res, next) => {
  for (const k of Object.keys(req.query)) {
    if (Array.isArray(req.query[k])) {
      req.query[k] = req.query[k][req.query[k].length - 1];
    }
  }
  next();
};

// ── Middleware: sanitize req.params ──────────────────────────────
const sanitizeParams = (req, res, next) => {
  for (const k of Object.keys(req.params)) {
    req.params[k] = stripTags(String(req.params[k])).slice(0, 100);
  }
  next();
};

// ── Exported helpers for use inside controllers ───────────────────
module.exports = {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  preventHpp,
  escapeHtml,  // use in controllers when you need to re-escape for HTML output
  stripTags,   // strip all HTML tags
  // Convenience: apply all three global middlewares as an array
  all: [sanitizeBody, sanitizeQuery, sanitizeParams, preventHpp],
};
