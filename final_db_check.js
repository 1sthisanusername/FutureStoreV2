require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const books = await pool.query("SELECT title FROM books WHERE title LIKE 'Book %'");
  console.log('Test Books:', books.rows.map(r => r.title).join(', '));
  const coupons = await pool.query("SELECT code FROM coupons WHERE code = 'ADMINTEST'");
  console.log('Test Coupons:', coupons.rows.map(r => r.code).join(', '));
  process.exit(0);
}

check();
