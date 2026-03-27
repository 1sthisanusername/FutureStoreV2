// controllers/subscribeController.js
const pool = require('../config/db');
const { sendMarketingWelcome } = require('../services/emailService');

const subscribe = async (req, res) => {
  const { email } = req.body;
  try {
    await pool.query('INSERT INTO email_subscribers (email) VALUES ($1)', [email]);
    sendMarketingWelcome(email).catch(() => {});
    res.json({ success: true, message: 'Subscribed! Check your inbox for a welcome offer.' });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'You are already subscribed!' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
};

const unsubscribe = async (req, res) => {
  try {
    await pool.query('UPDATE email_subscribers SET is_active=false WHERE email=$1', [req.body.email]);
    res.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Unsubscribe failed.' });
  }
};

module.exports = { subscribe, unsubscribe };
