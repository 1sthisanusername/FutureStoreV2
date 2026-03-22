const router   = require('express').Router();
const { body } = require('express-validator');
const pool     = require('../config/db');
const validate = require('../middleware/validate');
const { sanitizeBody } = require('../middleware/sanitize');
const { subscribeLimiter } = require('../middleware/rateLimiter');
const { sendMarketingWelcome } = require('../services/emailService');

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
  async (req, res) => {
    const { email } = req.body;
    try {
      await pool.query('INSERT INTO email_subscribers (email) VALUES (?)', [email]);
      sendMarketingWelcome(email).catch(() => {});
      res.json({ success: true, message: 'Subscribed! Check your inbox for a welcome offer.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.json({ success: true, message: 'You are already subscribed!' });
      throw err;
    }
  }
);

router.delete('/unsubscribe',
  sanitizeBody,
  [body('email').trim().isEmail().normalizeEmail()],
  validate,
  async (req, res) => {
    await pool.query('UPDATE email_subscribers SET is_active=0 WHERE email=?', [req.body.email]);
    res.json({ success: true, message: 'Unsubscribed successfully.' });
  }
);

module.exports = router;
