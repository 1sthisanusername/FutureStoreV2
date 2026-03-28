require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/config/db');

async function checkState() {
  try {
    const books = await pool.query("SELECT * FROM books WHERE title IN ('Book X', 'Book Y')");
    console.log('Books found:', books.rows.map(b => b.title));

    const coupons = await pool.query("SELECT * FROM coupons WHERE code = 'ADMINTEST'");
    console.log('Coupons found:', coupons.rows.map(c => c.code));

    const orders = await pool.query("SELECT id FROM orders WHERE id LIKE 'FS-%'");
    console.log('Orders found:', orders.rows.length);

    process.exit(0);
  } catch (err) {
    console.error('❌ DB Error:', err.message);
    process.exit(1);
  }
}

checkState();
