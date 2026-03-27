// controllers/supportController.js
const pool = require('../config/db');

const submitTicket = async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const { rows: [ticket] } = await pool.query(
      'INSERT INTO support_tickets (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, subject, message]
    );
    res.status(201).json({ 
      success: true, 
      message: 'Support ticket submitted! We will get back to you soon.',
      ticketId: ticket.id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit ticket.' });
  }
};

const getTickets = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

module.exports = { submitTicket, getTickets };
