// controllers/supportController.js
const pool = require('../config/db');

const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      subject VARCHAR(255),
      message TEXT,
      status VARCHAR(50) DEFAULT 'open',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
};

const createTicket = async (req, res) => {
  const { name, email, subject, message } = req.body;
  const userId = req.user ? req.user.id : null;
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    await createTable();
    await pool.query(
      'INSERT INTO support_tickets (user_id, name, email, subject, message) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, subject, message]
    );
    res.status(201).json({ success: true, message: 'Support ticket created successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create support ticket.' });
  }
};

const getTickets = async (req, res) => {
  try {
    await createTable();
    const { rows } = await pool.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

module.exports = { createTicket, getTickets };
