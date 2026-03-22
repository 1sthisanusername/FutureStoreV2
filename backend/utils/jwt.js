// utils/jwt.js — Access + Refresh token helpers
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const pool   = require('../config/db');

const ACCESS_EXPIRY  = process.env.JWT_EXPIRES_IN  || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const REFRESH_MS     = 7 * 24 * 60 * 60 * 1000;

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY });

const signRefresh = () => crypto.randomBytes(64).toString('hex');

const storeRefreshToken = async (userId, rawToken) => {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_MS);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',
    [userId, hash, expiresAt]
  );
  return rawToken;
};

const rotateRefreshToken = async (userId, oldRaw) => {
  const oldHash = crypto.createHash('sha256').update(oldRaw).digest('hex');
  const [rows] = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND expires_at > NOW()',
    [oldHash, userId]
  );
  if (!rows.length) throw new Error('Invalid or expired refresh token');

  // Delete old token (rotation)
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [oldHash]);

  const newRaw = signRefresh();
  await storeRefreshToken(userId, newRaw);
  return newRaw;
};

const revokeAllTokens = async (userId) => {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
};

module.exports = { signAccess, signRefresh, storeRefreshToken, rotateRefreshToken, revokeAllTokens };
