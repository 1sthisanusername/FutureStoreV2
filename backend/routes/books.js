// routes/books.js
const router   = require('express').Router();
const { body, query } = require('express-validator');
const ctrl     = require('../controllers/bookController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sanitizeBody, sanitizeQuery, preventHpp } = require('../middleware/sanitize');
const { searchLimiter } = require('../middleware/rateLimiter');
const coverGate = require('../middleware/coverGate');

// Sanitize all query strings and prevent HPP on every books route
router.use(sanitizeQuery, preventHpp, coverGate);

// ── SUGGEST (autocomplete) ────────────────────────────────────────
router.get('/suggest',
  searchLimiter,
  [query('q').optional().trim().isLength({ max: 100 }).escape()],
  validate, ctrl.suggest
);

// ── BOOK LIST with validated query params ─────────────────────────
router.get('/',
  searchLimiter,
  [
    query('q').optional().trim().isLength({ max: 200 }),
    query('genre').optional().trim().isLength({ max: 80 }).escape(),
    query('minPrice').optional().isFloat({ min: 0, max: 9999 }),
    query('maxPrice').optional().isFloat({ min: 0, max: 9999 }),
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('sort').optional().isIn(['id','title','price','rating','reviews_count','created_at']),
    query('order').optional().isIn(['ASC','DESC','asc','desc']),
    query('page').optional().isInt({ min: 1, max: 1000 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate, ctrl.getBooks
);

// ── GENRES ────────────────────────────────────────────────────────
router.get('/genres', ctrl.getGenres);

// ── SINGLE BOOK ───────────────────────────────────────────────────
router.get('/:id', ctrl.getBook);

// ── REVIEWS (authenticated, verified buyer only) ──────────────────
router.post('/:id/reviews',
  authenticate,
  sanitizeBody,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
    body('comment')
      .optional()
      .trim().escape()
      .isLength({ max: 1000 }).withMessage('Comment max 1000 characters'),
  ],
  validate, ctrl.addReview
);

module.exports = router;
