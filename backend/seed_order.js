require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  try {
    const { rows: [user] } = await pool.query("SELECT id FROM users LIMIT 1");
    const { rows: [book] } = await pool.query("SELECT id, price FROM books LIMIT 1");
    if (!user || !book) {
      console.log('User or Book missing.');
      process.exit(0);
    }

    const orderNum = 'FS-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const { rows: [order] } = await pool.query(
      `INSERT INTO orders (order_number, user_id, status, subtotal, shipping_fee, total, shipping_name, shipping_email, shipping_phone, shipping_address, payment_gateway, payment_id)
       VALUES ($1, $2, 'pending', $3, 0, $3, 'Test Customer', 'test@example.com', '1234567890', '123 Test Street, Debug City', 'razorpay', 'pay_test123') RETURNING id`,
      [orderNum, user.id, book.price]
    );

    await pool.query(
      `INSERT INTO order_items (order_id, book_id, qty, unit_price) VALUES ($1, $2, 1, $3)`,
      [order.id, book.id, book.price]
    );

    console.log('Order seeded:', orderNum);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
seed();
