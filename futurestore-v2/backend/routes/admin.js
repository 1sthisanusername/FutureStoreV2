// routes/admin.js
const router   = require('express').Router();
const { body, query } = require('express-validator');
const ctrl     = require('../controllers/adminController');
const { authenticate, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sanitizeBody, sanitizeQuery, preventHpp } = require('../middleware/sanitize');
const audit    = require('../middleware/auditLog');
const { adminWriteLimiter } = require('../middleware/rateLimiter');
const { upload, getFileUrl } = require('../services/s3Service');

router.use(authenticate, adminOnly, sanitizeBody, sanitizeQuery, preventHpp);

// ── DASHBOARD ─────────────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── BOOKS ─────────────────────────────────────────────────────────
router.get('/books',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('q').optional().trim().isLength({ max: 200 }),
  ],
  validate, ctrl.adminGetBooks
);
router.post('/books',
  adminWriteLimiter,
  upload.single('cover'),
  (req, res, next) => { if (req.file) req.body.cover_url = getFileUrl(req); next(); },
  [
    body('title').trim().escape().notEmpty().isLength({ max: 255 }),
    body('author').trim().escape().notEmpty().isLength({ max: 180 }),
    body('genre').trim().escape().notEmpty().isLength({ max: 80 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('price').isFloat({ min: 0, max: 9999 }),
    body('original_price').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
    body('stock').isInt({ min: 0, max: 99999 }),
    body('pages').optional({ nullable: true }).isInt({ min: 1, max: 9999 }),
    body('publisher').optional().trim().escape().isLength({ max: 120 }),
    body('year').optional({ nullable: true }).isInt({ min: 0, max: 2100 }),
    body('badge').optional({ nullable: true }).isIn(['NEW','SALE','CLASSIC','BESTSELLER',null,'']),
    body('cover_color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex colour'),
  ],
  validate, audit('CREATE_BOOK', 'book'), ctrl.createBook
);
router.put('/books/:id',
  adminWriteLimiter,
  upload.single('cover'),
  (req, res, next) => { if (req.file) req.body.cover_url = getFileUrl(req); next(); },
  [
    body('title').optional().trim().escape().isLength({ max: 255 }),
    body('author').optional().trim().escape().isLength({ max: 180 }),
    body('price').optional().isFloat({ min: 0, max: 9999 }),
    body('stock').optional().isInt({ min: 0, max: 99999 }),
    body('cover_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('badge').optional({ nullable: true }).isIn(['NEW','SALE','CLASSIC','BESTSELLER',null,'']),
    body('is_active').optional().isBoolean(),
  ],
  validate, audit('UPDATE_BOOK', 'book'), ctrl.updateBook
);
router.delete('/books/:id',
  adminWriteLimiter,
  audit('DELETE_BOOK', 'book'), ctrl.deleteBook
);

// ── INVENTORY ─────────────────────────────────────────────────────
router.get('/inventory', ctrl.getInventory);
router.patch('/inventory/:id/stock',
  adminWriteLimiter,
  [body('stock').isInt({ min: 0, max: 99999 })],
  validate, audit('UPDATE_STOCK', 'book'), ctrl.updateStock
);

// ── ORDERS ────────────────────────────────────────────────────────
router.get('/orders',
  [
    query('status').optional().isIn(['pending','confirmed','shipped','delivered','cancelled']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate, ctrl.adminGetOrders
);
router.patch('/orders/:id/status',
  adminWriteLimiter,
  [
    body('status').notEmpty().isIn(['pending','confirmed','shipped','delivered','cancelled']),
    body('note').optional().trim().escape().isLength({ max: 300 }),
    body('tracking_id').optional().trim().isLength({ max: 120 }),
  ],
  validate, audit('UPDATE_ORDER', 'order'), ctrl.updateOrderStatus
);

// ── COUPONS ───────────────────────────────────────────────────────
router.get('/coupons', ctrl.getCoupons);
router.post('/coupons',
  adminWriteLimiter,
  [
    body('code').trim().toUpperCase().notEmpty().isLength({ min: 2, max: 50 }).matches(/^[A-Z0-9_-]+$/),
    body('type').isIn(['percent','flat']),
    body('value').isFloat({ min: 0.01, max: 100 }),
    body('min_order').optional().isFloat({ min: 0 }),
    body('max_uses').optional({ nullable: true }).isInt({ min: 1 }),
    body('expires_at').optional({ nullable: true }).isISO8601(),
  ],
  validate, audit('CREATE_COUPON', 'coupon'), ctrl.createCoupon
);
router.delete('/coupons/:id',
  adminWriteLimiter,
  audit('DELETE_COUPON', 'coupon'), ctrl.deleteCoupon
);

// ── USERS ─────────────────────────────────────────────────────────
router.get('/users', ctrl.adminGetUsers);
router.patch('/users/:id/toggle',
  adminWriteLimiter,
  audit('TOGGLE_USER', 'user'), ctrl.toggleUserActive
);

// ── SUBSCRIBERS ───────────────────────────────────────────────────
router.get('/subscribers', ctrl.getSubscribers);

module.exports = router;
