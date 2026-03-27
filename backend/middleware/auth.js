// middleware/auth.js — JWT verification + role guard
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

// Verify JWT from Authorization header or cookie
const authenticate = async (req, res, next) => {
  try {
    const token =
      (req.headers.authorization || '').replace('Bearer ', '') ||
      req.cookies?.token;

    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, uuid, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active)
      return res.status(401).json({ success: false, message: 'Account not found or disabled' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Only allow admin role
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

module.exports = { authenticate, adminOnly };
