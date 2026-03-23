// controllers/wishlistController.js
const pool = require('../config/db');

const getWishlist = async (req, res) => {
  try {
    const { rows: rows } = await pool.query(
      `SELECT b.*,w.added_at FROM wishlist w JOIN books b ON b.id=w.book_id WHERE w.user_id=? ORDER BY w.added_at DESC`,
      [req.user.id]
    );
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist.' });
  }
};

const addToWishlist = async (req, res) => {
  try {
    await pool.query('INSERT INTO wishlist (user_id,book_id) VALUES (?,?)', [req.user.id, req.params.bookId]);
    res.status(201).json({ success:true, message:'Added to wishlist.' });
  } catch (err) {
    if (err.code==='ER_DUP_ENTRY') return res.json({ success:true, message:'Already in wishlist.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist.' });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE user_id=? AND book_id=?', [req.user.id, req.params.bookId]);
    res.json({ success:true, message:'Removed from wishlist.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist.' });
  }
};

const moveToCart = async (req, res) => {
  try {
    // Just removes from wishlist — frontend adds to cart state
    await pool.query('DELETE FROM wishlist WHERE user_id=? AND book_id=?', [req.user.id, req.params.bookId]);
    const { rows: [book] } = await pool.query('SELECT id,title,author,price,stock,cover_color FROM books WHERE id=? AND is_active=true', [req.params.bookId]);
    if (!book) return res.status(404).json({ success:false, message:'Book not found.' });
    res.json({ success:true, message:'Moved to cart.', data:book });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to move to cart.' });
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist, moveToCart };
