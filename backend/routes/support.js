// routes/support.js
const router = require('express').Router();
const ctrl = require('../controllers/supportController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { sanitizeBody } = require('../middleware/sanitize');

router.post('/',
  sanitizeBody,
  [
    body('name').trim().notEmpty().isLength({ max: 120 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('subject').trim().notEmpty().isLength({ max: 200 }),
    body('message').trim().notEmpty().isLength({ max: 2000 }),
  ],
  validate,
  ctrl.submitTicket
);

router.get('/', authenticate, adminOnly, ctrl.getTickets);

module.exports = router;
