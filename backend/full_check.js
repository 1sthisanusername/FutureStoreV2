require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT title, badge, reviews_count, is_active FROM books");
    console.table(res.rows);
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
}
check();
