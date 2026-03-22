// routes/orders.js
const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sanitizeBody } = require('../middleware/sanitize');
const { orderLimiter, couponLimiter } = require('../middleware/rateLimiter');

router.use(authenticate, sanitizeBody);

// ── COUPON VALIDATION ─────────────────────────────────────────────
router.post('/validate-coupon',
  couponLimiter,
  [
    body('code').trim().toUpperCase().notEmpty().isLength({ min: 2, max: 50 }).matches(/^[A-Z0-9_-]+$/).withMessage('Invalid coupon format'),
    body('subtotal').isFloat({ min: 0, max: 99999 }),
  ],
  validate, ctrl.validateCoupon
);

// ── PLACE ORDER ───────────────────────────────────────────────────
router.post('/',
  orderLimiter,
  [
    body('items').isArray({ min: 1, max: 50 }).withMessage('Cart must have 1–50 items'),
    body('items.*.id').isInt({ min: 1 }),
    body('items.*.qty').isInt({ min: 1, max: 99 }),
    body('coupon_code').optional().trim().toUpperCase().isLength({ max: 50 }).matches(/^[A-Z0-9_-]*$/),
    body('payment_gateway').optional().isIn(['razorpay','paypal','cod']),
    body('payment_id').optional().trim().isLength({ max: 120 }),
    body('shipping.name').optional().trim().escape().isLength({ max: 120 }),
    body('shipping.email').optional().isEmail().normalizeEmail(),
    body('shipping.phone').optional().trim().isLength({ max: 30 }),
    body('shipping.address').optional().trim().escape().isLength({ max: 500 }),
  ],
  validate, ctrl.placeOrder
);

// ── ORDER HISTORY ─────────────────────────────────────────────────
router.get('/',       ctrl.myOrders);
router.get('/:id',    ctrl.getOrder);
router.post('/:id/cancel',
  [body('reason').optional().trim().escape().isLength({ max: 300 })],
  validate, ctrl.cancelOrder
);
router.get('/:id/invoice', ctrl.getInvoice);

module.exports = router;
