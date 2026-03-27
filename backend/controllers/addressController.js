// controllers/addressController.js
const pool = require('../config/db');

const getAddresses = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, id DESC', [req.user.id]);
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses.' });
  }
};

const addAddress = async (req, res) => {
  try {
    const { label, name, phone, line1, line2, city, state, pincode, country, is_default } = req.body;
    if (is_default) await pool.query('UPDATE addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
    const { rows: r } = await pool.query(
      `INSERT INTO addresses (user_id,label,name,phone,line1,line2,city,state,pincode,country,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [req.user.id, label||'Home', name, phone||null, line1, line2||null, city, state, pincode, country||'India', is_default ? true : false]
    );
    const { rows: [addr] } = await pool.query('SELECT * FROM addresses WHERE id=$1', [r[0].id]);
    res.status(201).json({ success:true, data:addr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add address.' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { label, name, phone, line1, line2, city, state, pincode, country, is_default } = req.body;
    if (is_default) await pool.query('UPDATE addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
    await pool.query(
      `UPDATE addresses SET label=$1,name=$2,phone=$3,line1=$4,line2=$5,city=$6,state=$7,pincode=$8,country=$9,is_default=$10 WHERE id=$11 AND user_id=$12`,
      [label, name, phone||null, line1, line2||null, city, state, pincode, country||'India', is_default ? true : false, req.params.id, req.user.id]
    );
    res.json({ success:true, message:'Address updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update address.' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    await pool.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success:true, message:'Address removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete address.' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };
