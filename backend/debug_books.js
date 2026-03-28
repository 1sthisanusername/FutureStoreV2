require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT title, badge, reviews_count, is_active FROM books LIMIT 20");
    console.log('--- BOOKS ---');
    console.table(res.rows);
    const badgeCounts = await pool.query("SELECT badge, COUNT(*) FROM books GROUP BY badge");
    console.log('--- BADGE COUNTS ---');
    console.table(badgeCounts.rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
