require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM order_items LIMIT 1");
    if (res.rows.length === 0) {
      const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items'");
      console.log(cols.rows.map(r => r.column_name).join(', '));
    } else {
      console.log(Object.keys(res.rows[0]).join(', '));
    }
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
}
check();
