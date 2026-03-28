// routes/support.js
const router = require('express').Router();
const ctrl = require('../controllers/supportController');
const { authenticate, adminOnly } = require('../middleware/auth');

// Public route to create a support ticket from the contact form
router.post('/', ctrl.createTicket);

// Admin route to view tickets
router.get('/tickets', authenticate, adminOnly, ctrl.getTickets);

module.exports = router;
