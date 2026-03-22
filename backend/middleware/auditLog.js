// middleware/auditLog.js — write admin actions to audit_log
const pool = require('../config/db');

const audit = (action, entity = null) => async (req, res, next) => {
  // Store original json method to intercept response
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    if (data?.success) {
      try {
        await pool.query(
          `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.user?.id || null,
            action,
            entity,
            data?.data?.id || req.params?.id || null,
            JSON.stringify({ body: req.body, params: req.params }),
            req.ip,
          ]
        );
      } catch (_) { /* non-blocking */ }
    }
    return originalJson(data);
  };
  next();
};

module.exports = audit;
