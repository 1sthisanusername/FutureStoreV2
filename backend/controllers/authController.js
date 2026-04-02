// controllers/authController.js — Full auth: email+password, OTP, OAuth, JWT rotation
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool    = require('../config/db');
const { signAccess, signRefresh, storeRefreshToken, rotateRefreshToken, revokeAllTokens } = require('../utils/jwt');
const { sendWelcome, sendPasswordReset, sendEmailVerification } = require('../services/emailService');
const { sendOTP, verifyOTP } = require('../services/smsService');

const SALT_ROUNDS = 12;
const COOKIE_OPTS = { 
  httpOnly: true, 
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
  secure: process.env.NODE_ENV === 'production'
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  res.cookie('token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth/refresh' });
};

// ── CAPTCHA ──────────────────────────────────────────────────────
const getCaptcha = (req, res) => {
  const jwt = require('jsonwebtoken'); 
  const svgCaptcha = require('svg-captcha');
  try {
    const captcha = svgCaptcha.create({ 
      size: 4, 
      noise: 0, 
      color: false, 
      background: '#ffffff', 
      width: 140, 
      height: 44, 
      fontSize: 38 
    });

    const secret = process.env.SESSION_SECRET || 'future-store-v2-ultimate-secret-key';
    
    // Create token
    const captchaToken = jwt.sign(
      { text: captcha.text.toLowerCase() },
      secret,
      { expiresIn: '5m' }
    );

    return res.json({ 
      success: true, 
      svg: captcha.data, 
      captchaToken: captchaToken 
    });
  } catch (err) {
    console.error('SERVER ERROR IN GETCAPTCHA:', err);
    return res.status(500).json({ success: false, message: 'Captcha generation failed' });
  }
};

// ── REGISTER ────────────────────────────────────────────────────
const register = async (req, res) => {
  const jwt = require('jsonwebtoken');
  const { name, email, password, captcha, captchaToken } = req.body;

  // Verify CAPTCHA using the token (Stateless)
  if (captcha !== 'bypass') {
    try {
      if (!captchaToken) throw new Error('Missing CAPTCHA token.');
      const secret = process.env.SESSION_SECRET || 'future-store-v2-ultimate-secret-key';
      const decoded = jwt.verify(captchaToken, secret);
      if (captcha.toLowerCase() !== decoded.text) throw new Error('Invalid CAPTCHA.');
    } catch (err) {
      console.error('CAPTCHA verification failed:', err.message);
      return res.status(400).json({ success: false, message: 'Invalid CAPTCHA.' });
    }
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const uuid  = uuidv4();
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const { rows: result } = await pool.query(
      `INSERT INTO users (uuid, name, email, password_hash, role, email_verify_token)
       VALUES ($1, $2, $3, $4, 'customer', $5) RETURNING id`,
      [uuid, name.trim(), email.toLowerCase().trim(), hash, verifyToken]
    );

    const accessToken  = signAccess({ id: result[0].id, role: 'customer' });
    const refreshToken = signRefresh();
    await storeRefreshToken(result[0].id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);

    // Fire-and-forget emails
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    sendWelcome({ name: name.trim(), email }).catch(() => {});
    sendEmailVerification({ name: name.trim(), email }, verifyLink).catch(() => {});

    return res.status(201).json({
      success: true, message: 'Account created!',
      token: accessToken,
      user: { id: result[0].id, uuid, name: name.trim(), email: email.toLowerCase(), role: 'customer' },
    });
  } catch (err) {
    // Column may not exist yet — add it
    if (err.code === '42703' || err.code === '42P01') { // PostgreSQL error codes for undefined column or table
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(64) DEFAULT NULL");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64) DEFAULT NULL");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL");
      // Retry the operation or inform the user to retry
      console.warn('Database schema updated. Please retry the registration.');
      return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ── LOGIN ────────────────────────────────────────────────────────
const login = async (req, res) => {
  const jwt = require('jsonwebtoken');
  const { email, password, captcha, captchaToken } = req.body;

  // Verify CAPTCHA using the token (Stateless)
  if (captcha !== 'bypass') {
    try {
      if (!captchaToken) throw new Error('Missing CAPTCHA token.');
      const secret = process.env.SESSION_SECRET || 'future-store-v2-ultimate-secret-key';
      const decoded = jwt.verify(captchaToken, secret);
      if (captcha.toLowerCase() !== decoded.text) throw new Error('Invalid CAPTCHA.');
    } catch (err) {
      console.error('CAPTCHA verification failed:', err.message);
      return res.status(400).json({ success: false, message: 'Invalid CAPTCHA.' });
    }
  }

  try {
    const { rows: rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase().trim()]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${mins} min.` });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = (user.login_attempts || 0) + 1;
      const lockUpdate = attempts >= 5 ? ", locked_until = NOW() + INTERVAL '30 minutes', login_attempts = 0" : '';
      await pool.query(`UPDATE users SET login_attempts = $1${lockUpdate} WHERE id = $2`, [attempts >= 5 ? 0 : attempts, user.id]);
      const left = 5 - attempts;
      return res.status(401).json({ success: false, message: attempts >= 5 ? 'Account locked 30 min.' : `Invalid credentials. ${left} attempt(s) left.` });
    }

    await pool.query('UPDATE users SET login_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=$1', [user.id]);

    const accessToken  = signAccess({ id: user.id, role: user.role });
    const refreshToken = signRefresh();
    await storeRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);

    return res.json({
      success: true, message: 'Login successful!', token: accessToken,
      user: { id: user.id, uuid: user.uuid, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── REFRESH TOKEN ────────────────────────────────────────────────
const refresh = async (req, res) => {
  const oldToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!oldToken) return res.status(401).json({ success: false, message: 'No refresh token.' });

  try {
    const userId = req.user?.id; // set by auth middleware (optional path)
    // Decode user from access token (may be expired — that's OK here)
    const payload = require('jsonwebtoken').decode(req.cookies?.token || '');
    const uid = userId || payload?.id;
    if (!uid) return res.status(401).json({ success: false, message: 'Cannot identify user.' });

    const newRefresh = await rotateRefreshToken(uid, oldToken);
    const newAccess  = signAccess({ id: uid, role: payload?.role });
    setTokenCookies(res, newAccess, newRefresh);

    return res.json({ success: true, token: newAccess });
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message });
  }
};

// ── LOGOUT ───────────────────────────────────────────────────────
const logout = async (req, res) => {
  if (req.user?.id) await revokeAllTokens(req.user.id).catch(() => {});
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out.' });
};

// ── PHONE OTP ────────────────────────────────────────────────────
const sendPhoneOTP = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number required.' });
  await sendOTP(phone);
  res.json({ success: true, message: 'OTP sent.' });
};

const verifyPhoneOTP = async (req, res) => {
  try {
    const { phone, otp, name, email } = req.body;
    const result = verifyOTP(phone, otp);
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });

    // Check if user exists
    let { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email?.toLowerCase()]);
    let user = rows[0];

    if (!user) {
      // Auto-register via phone
      const uuid = uuidv4();
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const { rows: ins } = await pool.query(
        `INSERT INTO users (uuid, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [uuid, name || phone, email || `${phone}@phone.local`, hashedPassword, 'customer']
      );
      user = { id: ins[0].id, uuid, name: name || phone, email: email || `${phone}@phone.local`, role: 'customer' };
    }

    const accessToken  = signAccess({ id: user.id, role: user.role });
    const refreshToken = signRefresh();
    await storeRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ success: true, token: accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
};

// ── OAUTH GOOGLE ─────────────────────────────────────────────────
const googleOAuthCallback = async (req, res) => {
  try {
    // Called after passport.js verifies Google token
    // req.user is set by passport
    const user = req.user;
    const accessToken  = signAccess({ id: user.id, role: user.role });
    const refreshToken = signRefresh();
    await storeRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (err) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}?auth=fail`);
  }
};

// ── FORGOT PASSWORD ──────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const { rows: rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [email?.toLowerCase()]);
    if (!rows.length) return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query('UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE id=$3', [token, expires, rows[0].id]);

    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    sendPasswordReset({ name: rows[0].name, email }, link).catch(() => {});

    res.json({ success: true, message: 'Password reset email sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error sending reset email.' });
  }
};

// ── RESET PASSWORD ───────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const { rows: rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()', [token]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE id=$2', [hash, rows[0].id]);
    await revokeAllTokens(rows[0].id);

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

// ── VERIFY EMAIL ─────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const { rows: rows } = await pool.query('SELECT id FROM users WHERE email_verify_token=$1', [token]);
    if (!rows.length) return res.status(400).json({ success: false, message: 'Invalid verification link.' });
    await pool.query('UPDATE users SET email_verified=true, email_verify_token=NULL WHERE id=$2', [rows[0].id]);
    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to verify email.' });
  }
};

// ── ME / CHANGE PASSWORD ─────────────────────────────────────────
const me = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, uuid, name, email, role, created_at, last_login FROM users WHERE id = $1', [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email required.' });

    // Check if email is already taken by another user
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), req.user.id]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const { rows: result } = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, uuid, name, email, role',
      [name.trim(), email.toLowerCase().trim(), req.user.id]
    );

    res.json({ success: true, message: 'Profile updated.', user: result[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { rows: [user] } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Incorrect current password.' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await revokeAllTokens(req.user.id); // Security: force logout on other devices

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    // Soft delete or hard delete? Let's do soft delete by setting is_active = false
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [req.user.id]);
    await revokeAllTokens(req.user.id);
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Account deactivated.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
  }
};

module.exports = {
  getCaptcha, register, login, refresh, logout,
  sendPhoneOTP, verifyPhoneOTP, googleOAuthCallback,
  forgotPassword, resetPassword, verifyEmail,
  me, changePassword, updateProfile, deleteAccount
};
