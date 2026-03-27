// controllers/bookController.js — with Algolia search + S3 + reviews
const pool          = require('../config/db');
const { indexBook, removeBook, search: algoliaSearch } = require('../services/searchService');

// ── LIST / SEARCH ────────────────────────────────────────────────
const getBooks = async (req, res) => {
  try {
    const { genre, minPrice, maxPrice, minRating, sort='id', order='ASC', page=1, limit=20, q } = req.query;
    const allowedSorts  = ['id','title','price','rating','reviews_count','created_at'];
    const safeSort  = allowedSorts.includes(sort)  ? sort  : 'id';
    const safeOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Try Algolia first for text search
    if (q && q.trim()) {
      const algoliaResult = await algoliaSearch(q, { genre, minPrice, maxPrice, minRating, limit, page });
      if (algoliaResult) {
        const ids = algoliaResult.hits.map(h => h.id);
        if (!ids.length) return res.json({ success: true, data: [], meta: { total: 0 } });
        const { rows: books } = await pool.query(`SELECT * FROM books WHERE id = ANY($1) AND is_active=true`, [ids]);
        return res.json({ success: true, data: books, meta: { total: algoliaResult.total, pages: algoliaResult.pages, page: +page, source: 'algolia' } });
      }
    }

    // DB Fallback
    let where = ['b.is_active = true']; const params = [];
    if (genre)     { where.push(`b.genre = $${params.length+1}`);           params.push(genre); }
    if (minPrice)  { where.push(`b.price >= $${params.length+1}`);           params.push(+minPrice); }
    if (maxPrice)  { where.push(`b.price <= $${params.length+1}`);           params.push(+maxPrice); }
    if (minRating) { where.push(`b.rating >= $${params.length+1}`);          params.push(+minRating); }
    if (req.query.badge) { where.push(`b.badge = $${params.length+1}`);       params.push(req.query.badge); }
    if (q)         {
      const qp = `%${q}%`;
      where.push(`(b.title ILIKE $${params.length+1} OR b.author ILIKE $${params.length+2} OR b.genre ILIKE $${params.length+3})`);
      params.push(qp, qp, qp);
    }

    const wc = 'WHERE ' + where.join(' AND ');
    const offset = (Math.max(1,+page)-1) * Math.min(50,+limit);
    const { rows: [{ total }] } = await pool.query(`SELECT COUNT(*) AS total FROM books b ${wc}`, params);
    const { rows: books } = await pool.query(`SELECT * FROM books b ${wc} ORDER BY b.${safeSort} ${safeOrder} LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, Math.min(50,+limit), offset]);

    res.json({ success: true, data: books, meta: { total: parseInt(total), page:+page, limit:Math.min(50,+limit), pages:Math.ceil(total/+limit), source:'postgres' } });
  } catch (err) { console.error(err); res.status(500).json({ success:false, message:'Failed to fetch books.' }); }
};

// ── SINGLE BOOK ──────────────────────────────────────────────────
const getBook = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM books WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Book not found.' });
    const { rows: reviews } = await pool.query(
      `SELECT r.*, u.name AS reviewer_name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.book_id=$1 ORDER BY r.created_at DESC LIMIT 10`,
      [req.params.id]
    );
    // Related books (same genre, different book)
    const { rows: related } = await pool.query(
      'SELECT id,title,author,genre,price,rating,cover_color,badge FROM books WHERE genre=$1 AND id!=$2 AND is_active=true ORDER BY rating DESC LIMIT 4',
      [rows[0].genre, req.params.id]
    );
    res.json({ success:true, data: { ...rows[0], reviews, related } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch book.' });
  }
};

// ── GENRES ───────────────────────────────────────────────────────
const getGenres = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT genre, COUNT(*) AS count FROM books WHERE is_active=true GROUP BY genre ORDER BY count DESC');
    res.json({ success:true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch genres.' });
  }
};

// ── ADD REVIEW ───────────────────────────────────────────────────
const addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const bookId = req.params.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  }

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    
    // Verified buyer check
    const { rows: orders } = await conn.query(
      `SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id
       WHERE o.user_id=$1 AND oi.book_id=$2 AND o.status IN ('delivered','confirmed')`,
      [req.user.id, bookId]
    );
    if (!orders.length) {
      await conn.query('ROLLBACK'); conn.release();
      return res.status(403).json({ success:false, message:'Only verified buyers can review this book.' });
    }

    await conn.query('INSERT INTO reviews (book_id,user_id,rating,comment) VALUES ($1,$2,$3,$4)', [bookId, req.user.id, rating, comment||null]);
    
    // Atomic update of book stats
    await conn.query(
      `UPDATE books SET 
        rating = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE book_id=$1), 
        reviews_count = (SELECT COUNT(*) FROM reviews WHERE book_id=$2) 
       WHERE id=$3`,
      [bookId, bookId, bookId]
    );

    await conn.query('COMMIT'); conn.release();
    res.status(201).json({ success:true, message:'Review submitted!' });
  } catch (err) {
    if (conn) { await conn.query('ROLLBACK'); conn.release(); }
    if (err.code === '23505') return res.status(409).json({ success:false, message:'You already reviewed this book.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add review.' });
  }
};

// ── SEARCH SUGGESTIONS (autocomplete) ───────────────────────────
const suggest = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success:true, data:[] });
    const { rows: rows } = await pool.query(
      `SELECT id, title, author, genre FROM books WHERE (title ILIKE $1 OR author ILIKE $2) AND is_active=true LIMIT 8`,
      [`%${q}%`, `%${q}%`]
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch suggestions.' });
  }
};

module.exports = { getBooks, getBook, getGenres, addReview, suggest };
