require('dotenv').config();
const { signAccess } = require('./utils/jwt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  try {
    // 1. Get an existing order ID
    const { rows: [order] } = await pool.query("SELECT id FROM orders LIMIT 1");
    if (!order) {
      console.log('No orders found to test.');
      process.exit(0);
    }
    
    // 2. Get the admin user ID
    const { rows: [admin] } = await pool.query("SELECT id FROM users WHERE email='admin@futurestore.com'");
    if (!admin) {
        console.log('Admin user not found.');
        process.exit(0);
    }

    // 3. Sign a token
    const token = signAccess({ id: admin.id, role: 'admin' });
    console.log('Admin Token:', token);

    // 4. Test the endpoint
    const axios = require('axios');
    const res = await axios.get(`http://localhost:5000/api/admin/orders/${order.id}`, {
      headers: { Cookie: `token=${token}` }
    });
    
    console.log('--- ORDER DETAILS API TEST ---');
    console.log('Success:', res.data.success);
    console.log('Order Number:', res.data.data.order_number);
    console.log('Items Count:', res.data.data.items.length);
    if (res.data.data.items.length > 0) {
        console.log('First Item:', res.data.data.items[0].title);
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Verification failed:', e.message);
    if (e.response) console.error('Response:', e.response.data);
    process.exit(1);
  }
}
verify();
