// config/db.js — PostgreSQL via Supabase
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-convert MySQL ? placeholders to PostgreSQL $1, $2...
// so no controller code needs to change
const originalQuery = pool.query.bind(pool);
pool.query = (text, params) => {
  if (params && typeof text === 'string' && text.includes('?')) {
    let i = 0;
    text = text.replace(/\?/g, () => `$${++i}`);
  }
  return originalQuery(text, params);
};

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected (' + (process.env.PGHOST || 'localhost') + ')');
    client.release();
  })
  .catch(err => {
    console.error('❌ DB Connection Error:', err.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  });

module.exports = pool;
