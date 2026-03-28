require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'");
    console.log(res.rows.map(r => r.column_name).join(', '));
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
}
check();
