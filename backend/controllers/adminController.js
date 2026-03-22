// controllers/adminController.js — PostgreSQL version
const pool  = require('../config/db');
const { indexBook, removeBook } = require('../services/searchService');
const { sendShippingUpdate } = require('../services/emailService');

// ── DASHBOARD ────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  const { rows: [{ totalusers }] }   = await pool.query("SELECT COUNT(*) AS totalUsers FROM users WHERE role='customer'");
  const { rows: [{ totalorders }] }  = await pool.query('SELECT COUNT(*) AS totalOrders FROM orders');
  const { rows: [{ totalrevenue }] } = await pool.query("SELECT COALESCE(SUM(total),0) AS totalRevenue FROM orders WHERE status!='cancelled'");
  const { rows: [{ totalbooks }] }   = await pool.query('SELECT COUNT(*) AS totalBooks FROM books WHERE is_active=true');
  const { rows: [{ lowstock }] }     = await pool.query('SELECT COUNT(*) AS lowStock FROM books WHERE stock<=5 AND is_active=true');
  const { rows: [{ pendingorders }] }= await pool.query("SELECT COUNT(*) AS pendingOrders FROM orders WHERE status='pending'");

  const { rows: revenueChart } = await pool.query(
    "SELECT DATE(created_at) AS date, SUM(total) AS revenue, COUNT(*) AS orders FROM orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status!='cancelled' GROUP BY DATE(created_at) ORDER BY date ASC"
  );
  const { rows: recentOrders } = await pool.query(
    'SELECT o.*,u.name AS customer_name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 8'
  );
  const { rows: topBooks } = await pool.query(
    'SELECT b.id,b.title,b.author,b.price,b.stock, COALESCE(SUM(oi.qty),0) AS units_sold FROM books b LEFT JOIN order_items oi ON oi.book_id=b.id GROUP BY b.id ORDER BY units_sold DESC LIMIT 5'
  );
  const { rows: auditLogs } = await pool.query(
    'SELECT al.*,u.name AS actor FROM audit_log al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.created_at DESC LIMIT 20'
  );
  const { rows: lowStockBooks } = await pool.query('SELECT id,title,stock,genre FROM books WHERE stock<=5 AND is_active=true ORDER BY stock ASC');

  res.json({
    success: true,
    data: {
      totalUsers: parseInt(totalusers),
      totalOrders: parseInt(totalorders),
      totalRevenue: parseFloat(totalrevenue),
      totalBooks: parseInt(totalbooks),
      lowStock: parseInt(lowstock),
      pendingOrders: parseInt(pendingorders),
      revenueChart, recentOrders, topBooks, auditLogs, lowStockBooks
    }
  });
};

// ── BOOKS CRUD ───────────────────────────────────────────────────
const adminGetBooks = async (req, res) => {
  const { page=1, limit=30, q } = req.query;
  const offset = (+page-1)*+limit;
  let where=''; const params=[];
  if (q) { where='WHERE title ILIKE $1 OR author ILIKE $2'; params.push(`%${q}%`,`%${q}%`); }
  const countQ = `SELECT COUNT(*) AS total FROM books ${where}`;
  const { rows: [{ total }] } = await pool.query(countQ, params);
  const booksQ = `SELECT * FROM books ${where} ORDER BY id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  const { rows: books } = await pool.query(booksQ, [...params, +limit, offset]);
  res.json({ success:true, data:books, meta:{ total:parseInt(total), page:+page } });
};

const createBook = async (req, res) => {
  const { title,author,genre,description,price,original_price,stock,pages,publisher,year,badge,cover_color,cover_url } = req.body;
  const { rows: [book] } = await pool.query(
    `INSERT INTO books (title,author,genre,description,price,original_price,stock,pages,publisher,year,badge,cover_color,cover_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [title,author,genre,description||null,price,original_price||null,stock||0,pages||null,publisher||null,year||null,badge||null,cover_color||'#2C3E50',cover_url||null]
  );
  indexBook(book).catch(()=>{});
  res.status(201).json({ success:true, message:'Book created.', data:book });
};

const updateBook = async (req, res) => {
  const fields = ['title','author','genre','description','price','original_price','stock','pages','publisher','year','badge','cover_color','cover_url','is_active'];
  const updates=[]; const vals=[];
  for (const f of fields) {
    if (req.body[f]!==undefined) { updates.push(`${f}=$${updates.length+1}`); vals.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ success:false, message:'No fields to update.' });
  vals.push(req.params.id);
  const { rows: [book] } = await pool.query(`UPDATE books SET ${updates.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  indexBook(book).catch(()=>{});
  res.json({ success:true, message:'Book updated.', data:book });
};

const deleteBook = async (req, res) => {
  await pool.query('UPDATE books SET is_active=false WHERE id=$1', [req.params.id]);
  removeBook(req.params.id).catch(()=>{});
  res.json({ success:true, message:'Book removed from catalog.' });
};

// ── INVENTORY ────────────────────────────────────────────────────
const getInventory = async (req, res) => {
  const { rows: books } = await pool.query(
    'SELECT id,title,author,genre,price,stock,badge,is_active, COALESCE((SELECT SUM(qty) FROM order_items WHERE book_id=books.id),0) AS units_sold FROM books ORDER BY stock ASC'
  );
  res.json({ success:true, data:books });
};

const updateStock = async (req, res) => {
  const { stock } = req.body;
  if (stock===undefined||stock<0) return res.status(400).json({ success:false, message:'Invalid stock value.' });
  await pool.query('UPDATE books SET stock=$1 WHERE id=$2', [stock, req.params.id]);
  res.json({ success:true, message:`Stock updated to ${stock}.` });
};

// ── ORDERS ───────────────────────────────────────────────────────
const adminGetOrders = async (req, res) => {
  const { status, page=1, limit=20 } = req.query;
  const offset=(+page-1)*+limit;
  let where=''; const params=[];
  if (status) { where='WHERE o.status=$1'; params.push(status); }
  const { rows: [{ total }] } = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
  const { rows: orders } = await pool.query(
    `SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id ${where} ORDER BY o.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, +limit, offset]
  );
  res.json({ success:true, data:orders, meta:{ total:parseInt(total), page:+page } });
};

const updateOrderStatus = async (req, res) => {
  const { status, note, tracking_id } = req.body;
  const valid = ['pending','confirmed','shipped','delivered','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ success:false, message:'Invalid status.' });
  const updates=['status=$1']; const vals=[status];
  if (tracking_id) { updates.push(`tracking_id=$${vals.length+1}`); vals.push(tracking_id); }
  vals.push(req.params.id);
  await pool.query(`UPDATE orders SET ${updates.join(',')} WHERE id=$${vals.length}`, vals);
  await pool.query('INSERT INTO order_status_history (order_id,status,note,changed_by) VALUES ($1,$2,$3,$4)', [req.params.id, status, note||null, req.user.id]);
  if (status==='shipped') {
    const { rows: [order] } = await pool.query('SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1', [req.params.id]);
    if (order) sendShippingUpdate({ ...order, tracking_id }, { name:order.name, email:order.email }).catch(()=>{});
  }
  res.json({ success:true, message:`Order status → "${status}".` });
};

// ── COUPONS ──────────────────────────────────────────────────────
const getCoupons = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json({ success:true, data:rows });
};

const createCoupon = async (req, res) => {
  const { code, type, value, min_order, max_uses, expires_at } = req.body;
  try {
    const { rows: [c] } = await pool.query(
      'INSERT INTO coupons (code,type,value,min_order,max_uses,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,code',
      [code.toUpperCase(), type||'percent', value, min_order||0, max_uses||null, expires_at||null]
    );
    res.status(201).json({ success:true, message:'Coupon created.', data:c });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Coupon code already exists.' });
    throw err;
  }
};

const deleteCoupon = async (req, res) => {
  await pool.query('UPDATE coupons SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ success:true, message:'Coupon deactivated.' });
};

// ── USERS ────────────────────────────────────────────────────────
const adminGetUsers = async (req, res) => {
  const { rows: users } = await pool.query(
    'SELECT u.id,u.uuid,u.name,u.email,u.role,u.is_active,u.created_at,u.last_login, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC'
  );
  res.json({ success:true, data:users });
};

const toggleUserActive = async (req, res) => {
  const { rows: [user] } = await pool.query('SELECT id,is_active FROM users WHERE id=$1', [req.params.id]);
  if (!user) return res.status(404).json({ success:false, message:'User not found.' });
  await pool.query('UPDATE users SET is_active=$1 WHERE id=$2', [!user.is_active, req.params.id]);
  res.json({ success:true, message:`User ${!user.is_active?'enabled':'disabled'}.` });
};

// ── SUBSCRIBERS ──────────────────────────────────────────────────
const getSubscribers = async (req, res) => {
  const { rows: [{ total }] } = await pool.query('SELECT COUNT(*) AS total FROM email_subscribers WHERE is_active=true');
  const { rows } = await pool.query('SELECT * FROM email_subscribers ORDER BY created_at DESC LIMIT 100');
  res.json({ success:true, data:rows, meta:{ total:parseInt(total) } });
};

module.exports = {
  getDashboard,
  adminGetBooks, createBook, updateBook, deleteBook,
  getInventory, updateStock,
  adminGetOrders, updateOrderStatus,
  getCoupons, createCoupon, deleteCoupon,
  adminGetUsers, toggleUserActive,
  getSubscribers,
};
