// controllers/orderController.js — PostgreSQL version
const pool  = require('../config/db');
const { generateInvoiceHTML } = require('../utils/invoice');
const { sendOrderConfirmation, sendShippingUpdate } = require('../services/emailService');

const genOrderNumber = () => 'FS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();

// Helper: run a query on a pg client with ? → $n conversion
const cq = (conn, text, params=[]) => {
  if (text.includes('?')) {
    let i=0; text = text.replace(/\?/g, ()=>`$${++i}`);
  }
  return conn.query(text, params);
};

// ── PLACE ORDER ──────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const { items, address_id, shipping, payment_gateway, payment_id, coupon_code } = req.body;
  if (!items?.length) return res.status(400).json({ success:false, message:'Cart is empty.' });

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    let subtotal=0; const enriched=[];
    for (const item of items) {
      const r = await cq(conn, 'SELECT id,price,stock,title FROM books WHERE id=? AND is_active=true', [item.id]);
      const book = r.rows[0];
      if (!book) throw new Error(`Book #${item.id} not found.`);
      if (book.stock < item.qty) throw new Error(`"${book.title}" only has ${book.stock} in stock.`);
      subtotal += parseFloat(book.price) * item.qty;
      enriched.push({ ...book, qty: item.qty });
    }

    let discount=0, couponRecord=null;
    if (coupon_code) {
      const cr = await cq(conn, `SELECT * FROM coupons WHERE code=? AND is_active=true AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)`, [coupon_code.toUpperCase()]);
      const coupon = cr.rows[0];
      if (!coupon) throw new Error('Invalid or expired coupon code.');
      if (subtotal < coupon.min_order) throw new Error(`Minimum order $${coupon.min_order} required.`);
      discount = coupon.type==='percent' ? subtotal*(coupon.value/100) : parseFloat(coupon.value);
      discount = Math.min(discount, subtotal);
      couponRecord = coupon;
    }

    const shippingFee = subtotal >= 35 ? 0 : 4.99;
    const total = +(subtotal - discount + shippingFee).toFixed(2);
    const orderNumber = genOrderNumber();

    let shippingDetails = shipping || {};
    if (address_id) {
      const ar = await cq(conn, 'SELECT * FROM addresses WHERE id=? AND user_id=?', [address_id, req.user.id]);
      const addr = ar.rows[0];
      if (addr) shippingDetails = { name: addr.name, email: req.user.email, phone: addr.phone, address: `${addr.line1}, ${addr.line2||''}, ${addr.city}, ${addr.state} ${addr.pincode}` };
    }

    const ordR = await cq(conn,
      `INSERT INTO orders (order_number,user_id,status,subtotal,shipping_fee,total,discount,coupon_code,payment_gateway,payment_id,shipping_name,shipping_email,shipping_phone,shipping_address)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      [orderNumber, req.user.id, 'confirmed', subtotal.toFixed(2), shippingFee.toFixed(2), total,
       discount.toFixed(2), couponRecord?.code||null, payment_gateway||null, payment_id||null,
       shippingDetails.name||req.user.name, shippingDetails.email||req.user.email,
       shippingDetails.phone||null, shippingDetails.address||null]
    );
    const orderId = ordR.rows[0].id;

    for (const b of enriched) {
      await cq(conn, 'INSERT INTO order_items (order_id,book_id,qty,unit_price) VALUES (?,?,?,?)', [orderId, b.id, b.qty, b.price]);
      await cq(conn, 'UPDATE books SET stock=stock-? WHERE id=?', [b.qty, b.id]);
    }
    if (couponRecord) await cq(conn, 'UPDATE coupons SET uses=uses+1 WHERE id=?', [couponRecord.id]);
    await cq(conn, 'INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)', [orderId, 'confirmed', 'Order placed']);

    await conn.query('COMMIT'); conn.release();

    const fullOrder = await pool.query('SELECT * FROM orders WHERE id=?', [orderId]);
    sendOrderConfirmation(fullOrder.rows[0], req.user).catch(()=>{});

    res.status(201).json({ success:true, message:'Order placed!', data: { orderId, orderNumber, total, discount } });
  } catch (err) {
    await conn.query('ROLLBACK'); conn.release();
    res.status(400).json({ success:false, message: err.message });
  }
};

// ── MY ORDERS ────────────────────────────────────────────────────
const myOrders = async (req, res) => {
  const { rows: orders } = await pool.query('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
  for (const o of orders) {
    const { rows } = await pool.query(`SELECT oi.*,b.title,b.author,b.cover_color FROM order_items oi JOIN books b ON b.id=oi.book_id WHERE oi.order_id=?`, [o.id]);
    o.items = rows;
  }
  res.json({ success:true, data:orders });
};

// ── SINGLE ORDER ─────────────────────────────────────────────────
const getOrder = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ success:false, message:'Order not found.' });
  const { rows: items } = await pool.query(`SELECT oi.*,b.title,b.author FROM order_items oi JOIN books b ON b.id=oi.book_id WHERE oi.order_id=?`, [rows[0].id]);
  const { rows: history } = await pool.query('SELECT * FROM order_status_history WHERE order_id=? ORDER BY created_at ASC', [rows[0].id]);
  res.json({ success:true, data: { ...rows[0], items, history } });
};

// ── CANCEL ORDER ─────────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const r = await cq(conn, 'SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    const order = r.rows[0];
    if (!order) throw new Error('Order not found.');
    if (!['pending','confirmed'].includes(order.status)) throw new Error('Only pending/confirmed orders can be cancelled.');
    await cq(conn, "UPDATE orders SET status='cancelled' WHERE id=?", [order.id]);
    const { rows: items } = await cq(conn, 'SELECT * FROM order_items WHERE order_id=?', [order.id]);
    for (const item of items) await cq(conn, 'UPDATE books SET stock=stock+? WHERE id=?', [item.qty, item.book_id]);
    await cq(conn, 'INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)', [order.id, 'cancelled', req.body.reason||'Customer request']);
    await conn.query('COMMIT'); conn.release();
    res.json({ success:true, message:'Order cancelled.' });
  } catch (err) {
    await conn.query('ROLLBACK'); conn.release();
    res.status(400).json({ success:false, message:err.message });
  }
};

// ── INVOICE ──────────────────────────────────────────────────────
const getInvoice = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ success:false, message:'Order not found.' });
  const { rows: items } = await pool.query(`SELECT oi.*,b.title,b.author FROM order_items oi JOIN books b ON b.id=oi.book_id WHERE oi.order_id=?`, [rows[0].id]);
  const html = generateInvoiceHTML(rows[0], items, req.user);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};

// ── VALIDATE COUPON ──────────────────────────────────────────────
const validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;
  const { rows } = await pool.query(`SELECT * FROM coupons WHERE code=? AND is_active=true AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)`, [code?.toUpperCase()]);
  if (!rows.length) return res.status(404).json({ success:false, message:'Invalid or expired coupon.' });
  const coupon = rows[0];
  if (subtotal < coupon.min_order) return res.status(400).json({ success:false, message:`Minimum order $${coupon.min_order} required.` });
  const discount = coupon.type==='percent' ? subtotal*(coupon.value/100) : coupon.value;
  res.json({ success:true, data: { code:coupon.code, type:coupon.type, value:coupon.value, discount:Math.min(discount,subtotal) } });
};

module.exports = { placeOrder, myOrders, getOrder, cancelOrder, getInvoice, validateCoupon };
