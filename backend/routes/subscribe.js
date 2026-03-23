const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/subscribeController');
const validate = require('../middleware/validate');
const { sanitizeBody } = require('../middleware/sanitize');
const { subscribeLimiter } = require('../middleware/rateLimiter');

router.post('/',
  subscribeLimiter,
  sanitizeBody,
  [
    body('email')
      .trim().toLowerCase()
      .isEmail().withMessage('Valid email required')
      .normalizeEmail()
      .isLength({ max: 180 }),
  ],
  validate,
  ctrl.subscribe
);

router.delete('/unsubscribe',
  sanitizeBody,
  [body('email').trim().isEmail().normalizeEmail()],
  validate,
  ctrl.unsubscribe
);

module.exports = router;
