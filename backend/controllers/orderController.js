// controllers/orderController.js — PostgreSQL version
const pool  = require('../config/db');
const { generateInvoiceHTML } = require('../utils/invoice');
const { sendOrderConfirmation, sendShippingUpdate } = require('../services/emailService');

const genOrderNumber = () => 'FS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();

// ── PLACE ORDER ──────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const { items, address_id, shipping, payment_gateway, payment_id, coupon_code } = req.body;
  if (!items?.length) return res.status(400).json({ success:false, message:'Cart is empty.' });

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    let subtotal=0; const enriched=[];
    for (const item of items) {
      const r = await conn.query('SELECT id,price,stock,title FROM books WHERE id=$1 AND is_active=true FOR UPDATE', [item.id]);
      const book = r.rows[0];
      if (!book) throw new Error(`Book #${item.id} not found.`);
      if (book.stock < item.qty) throw Error(`"${book.title}" only has ${book.stock} in stock.`);
      subtotal += parseFloat(book.price) * item.qty;
      enriched.push({ ...book, qty: item.qty });
    }

    let discount=0, couponRecord=null;
    if (coupon_code) {
      const cr = await conn.query(`SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)`, [coupon_code.toUpperCase()]);
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
      const ar = await conn.query('SELECT * FROM addresses WHERE id=$1 AND user_id=$2', [address_id, req.user.id]);
      const addr = ar.rows[0];
      if (addr) shippingDetails = { name: addr.name, email: req.user.email, phone: addr.phone, address: `${addr.line1}, ${addr.line2||''}, ${addr.city}, ${addr.state} ${addr.pincode}` };
    }

    const ordR = await conn.query(
      `INSERT INTO orders (order_number,user_id,status,subtotal,shipping_fee,total,discount,coupon_code,payment_gateway,payment_id,shipping_name,shipping_email,shipping_phone,shipping_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [orderNumber, req.user.id, 'confirmed', subtotal.toFixed(2), shippingFee.toFixed(2), total,
       discount.toFixed(2), couponRecord?.code||null, payment_gateway||null, payment_id||null,
       shippingDetails.name||req.user.name, shippingDetails.email||req.user.email,
       shippingDetails.phone||null, shippingDetails.address||null]
    );
    const orderId = ordR.rows[0].id;

    for (const b of enriched) {
      await conn.query('INSERT INTO order_items (order_id,book_id,qty,unit_price) VALUES ($1,$2,$3,$4)', [orderId, b.id, b.qty, b.price]);
      await conn.query('UPDATE books SET stock=stock-$1 WHERE id=$2', [b.qty, b.id]);
    }
    if (couponRecord) await conn.query('UPDATE coupons SET uses=uses+1 WHERE id=$1', [couponRecord.id]);
    await conn.query('INSERT INTO order_status_history (order_id,status,note) VALUES ($1,$2,$3)', [orderId, 'confirmed', 'Order placed']);

    await conn.query('COMMIT'); conn.release();

    const fullOrder = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    sendOrderConfirmation(fullOrder.rows[0], req.user).catch(()=>{});

    res.status(201).json({ success:true, message:'Order placed!', data: { orderId, orderNumber, total, discount } });
  } catch (err) {
    if (conn) { await conn.query('ROLLBACK'); conn.release(); }
    res.status(400).json({ success:false, message: err.message });
  }
};

// ── MY ORDERS ────────────────────────────────────────────────────
const myOrders = async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT
        o.id AS order_id, o.*,
        oi.id AS item_id, oi.qty, oi.unit_price,
        b.id AS book_id, b.title, b.author, b.cover_color
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN books b ON b.id = oi.book_id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC, o.id DESC`,
      [req.user.id]
    );

    const ordersMap = new Map();
    for (const row of orders) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          order_number: row.order_number,
          status: row.status,
          subtotal: row.subtotal,
          shipping_fee: row.shipping_fee,
          total: row.total,
          discount: row.discount,
          coupon_code: row.coupon_code,
          created_at: row.created_at,
          items: [],
        });
      }
      ordersMap.get(row.order_id).items.push({
        id: row.item_id,
        book_id: row.book_id,
        qty: row.qty,
        unit_price: row.unit_price,
        title: row.title,
        author: row.author,
        cover_color: row.cover_color,
      });
    }

    res.json({ success: true, data: Array.from(ordersMap.values()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
};

// ── SINGLE ORDER ─────────────────────────────────────────────────
const getOrder = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        o.*,
        oi.id AS item_id, oi.qty, oi.unit_price,
        b.id AS book_id, b.title, b.author,
        h.id AS history_id, h.status AS history_status, h.note AS history_note, h.created_at AS history_date
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN books b ON b.id = oi.book_id
      LEFT JOIN order_status_history h ON h.order_id = o.id
      WHERE o.id = $1 AND o.user_id = $2
      ORDER BY h.created_at ASC`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ success:false, message:'Order not found.' });

    const order = {
      id: rows[0].id,
      order_number: rows[0].order_number,
      status: rows[0].status,
      subtotal: rows[0].subtotal,
      shipping_fee: rows[0].shipping_fee,
      total: rows[0].total,
      discount: rows[0].discount,
      coupon_code: rows[0].coupon_code,
      created_at: rows[0].created_at,
      items: [],
      history: [],
    };

    const itemsMap = new Map();
    const historyMap = new Map();

    for (const row of rows) {
      if (row.item_id && !itemsMap.has(row.item_id)) {
        itemsMap.set(row.item_id, true);
        order.items.push({
          id: row.item_id,
          book_id: row.book_id,
          qty: row.qty,
          unit_price: row.unit_price,
          title: row.title,
          author: row.author,
        });
      }
      if (row.history_id && !historyMap.has(row.history_id)) {
        historyMap.set(row.history_id, true);
        order.history.push({
          id: row.history_id,
          status: row.history_status,
          note: row.history_note,
          created_at: row.history_date,
        });
      }
    }

    res.json({ success:true, data: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
  }
};

// ── CANCEL ORDER ─────────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const r = await conn.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    const order = r.rows[0];
    if (!order) throw new Error('Order not found.');
    if (!['pending','confirmed'].includes(order.status)) throw new Error('Only pending/confirmed orders can be cancelled.');
    await conn.query("UPDATE orders SET status='cancelled' WHERE id=$1", [order.id]);
    const { rows: items } = await conn.query('SELECT * FROM order_items WHERE order_id=$1', [order.id]);
    for (const item of items) await conn.query('UPDATE books SET stock=stock+$1 WHERE id=$2', [item.qty, item.book_id]);
    await conn.query('INSERT INTO order_status_history (order_id,status,note) VALUES ($1,$2,$3)', [order.id, 'cancelled', req.body.reason||'Customer request']);
    await conn.query('COMMIT'); conn.release();
    res.json({ success:true, message:'Order cancelled.' });
  } catch (err) {
    if (conn) { await conn.query('ROLLBACK'); conn.release(); }
    res.status(400).json({ success:false, message:err.message });
  }
};

// ── INVOICE ──────────────────────────────────────────────────────
const getInvoice = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Order not found.' });
    const { rows: items } = await pool.query(`SELECT oi.*,b.title,b.author FROM order_items oi JOIN books b ON b.id=oi.book_id WHERE oi.order_id=$1`, [rows[0].id]);
    const html = generateInvoiceHTML(rows[0], items, req.user);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate invoice.' });
  }
};

// ── VALIDATE COUPON ──────────────────────────────────────────────
const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const { rows } = await pool.query(`SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)`, [code?.toUpperCase()]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Invalid or expired coupon.' });
    const coupon = rows[0];
    if (subtotal < coupon.min_order) return res.status(400).json({ success:false, message:`Minimum order $${coupon.min_order} required.` });
    const discount = coupon.type==='percent' ? subtotal*(coupon.value/100) : coupon.value;
    res.json({ success:true, data: { code:coupon.code, type:coupon.type, value:coupon.value, discount:Math.min(discount,subtotal) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to validate coupon.' });
  }
};

module.exports = { placeOrder, myOrders, getOrder, cancelOrder, getInvoice, validateCoupon };
