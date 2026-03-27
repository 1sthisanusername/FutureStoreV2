// routes/auth.js
const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/authController');
const validate = require('../middleware/validate');
const { sanitizeBody, sanitizeQuery } = require('../middleware/sanitize');
const { authenticate } = require('../middleware/auth');
const { authLimiter, resetLimiter, otpLimiter } = require('../middleware/rateLimiter');

// Apply body + query sanitisation to every auth route
router.use(sanitizeBody, sanitizeQuery);

// ── CAPTCHA ───────────────────────────────────────────────────────
router.get('/captcha', ctrl.getCaptcha);

// ── REGISTER ─────────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  [
    body('name')
      .trim().escape()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters'),
    body('email')
      .trim().toLowerCase()
      .isEmail().withMessage('Valid email required')
      .normalizeEmail()
      .isLength({ max: 180 }),
    body('password')
      .isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number')
      .matches(/[!@#$%^&*]/).withMessage('Must contain a special character (!@#$%^&*)'),
    body('captcha')
      .trim()
      .notEmpty().withMessage('CAPTCHA is required')
      .isLength({ max: 20 }),
  ],
  validate, ctrl.register
);

// ── LOGIN ─────────────────────────────────────────────────────────
router.post('/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').isLength({ max: 128 }),
    body('captcha').trim().notEmpty().withMessage('CAPTCHA is required').isLength({ max: 20 }),
  ],
  validate, ctrl.login
);

// ── TOKEN MANAGEMENT ─────────────────────────────────────────────
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me',      authenticate, ctrl.me);

router.put('/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 120 }),
    body('email').optional().trim().isEmail().normalizeEmail(),
  ],
  validate, ctrl.updateProfile
);
router.delete('/me', authenticate, ctrl.deleteAccount);

// ── CHANGE PASSWORD ───────────────────────────────────────────────
router.put('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().isLength({ max: 128 }),
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .matches(/[A-Z]/).matches(/[0-9]/).matches(/[!@#$%^&*]/),
  ],
  validate, ctrl.changePassword
);

// ── PHONE OTP ─────────────────────────────────────────────────────
router.post('/otp/send',
  otpLimiter,
  [body('phone').trim().notEmpty().isMobilePhone().withMessage('Valid phone required')],
  validate, ctrl.sendPhoneOTP
);
router.post('/otp/verify',
  otpLimiter,
  [
    body('phone').trim().notEmpty().isMobilePhone(),
    body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],
  validate, ctrl.verifyPhoneOTP
);

// ── PASSWORD RESET ────────────────────────────────────────────────
router.post('/forgot-password',
  resetLimiter,
  [body('email').trim().isEmail().normalizeEmail()],
  validate, ctrl.forgotPassword
);
router.post('/reset-password',
  resetLimiter,
  [
    body('token').trim().notEmpty().isLength({ min: 64, max: 64 }),
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .matches(/[A-Z]/).matches(/[0-9]/).matches(/[!@#$%^&*]/),
  ],
  validate, ctrl.resetPassword
);

// ── EMAIL VERIFICATION ────────────────────────────────────────────
router.get('/verify-email',
  sanitizeQuery,
  ctrl.verifyEmail
);

// ── OAUTH ─────────────────────────────────────────────────────────
router.get('/google/callback', ctrl.googleOAuthCallback);

module.exports = router;
