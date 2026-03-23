// controllers/addressController.js
const pool = require('../config/db');

const getAddresses = async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC', [req.user.id]);
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses.' });
  }
};

const addAddress = async (req, res) => {
  try {
    const { label, name, phone, line1, line2, city, state, pincode, country, is_default } = req.body;
    if (is_default) await pool.query('UPDATE addresses SET is_default=0 WHERE user_id=?', [req.user.id]);
    const { rows: r } = await pool.query(
      `INSERT INTO addresses (user_id,label,name,phone,line1,line2,city,state,pincode,country,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, label||'Home', name, phone||null, line1, line2||null, city, state, pincode, country||'India', is_default?1:0]
    );
    const { rows: [addr] } = await pool.query('SELECT * FROM addresses WHERE id=?', [r.rows[0].id]);
    res.status(201).json({ success:true, data:addr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add address.' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { label, name, phone, line1, line2, city, state, pincode, country, is_default } = req.body;
    if (is_default) await pool.query('UPDATE addresses SET is_default=0 WHERE user_id=?', [req.user.id]);
    await pool.query(
      `UPDATE addresses SET label=?,name=?,phone=?,line1=?,line2=?,city=?,state=?,pincode=?,country=?,is_default=? WHERE id=? AND user_id=?`,
      [label, name, phone||null, line1, line2||null, city, state, pincode, country||'India', is_default?1:0, req.params.id, req.user.id]
    );
    res.json({ success:true, message:'Address updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update address.' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    await pool.query('DELETE FROM addresses WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success:true, message:'Address removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete address.' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };
