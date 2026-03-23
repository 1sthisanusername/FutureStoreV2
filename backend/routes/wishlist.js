const router = require('express').Router();
const { param } = require('express-validator');
const ctrl   = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

const bookIdValidation = [
  param('bookId').isInt().withMessage('Book ID must be an integer'),
];

router.get('/',                  ctrl.getWishlist);
router.post('/:bookId',          bookIdValidation, validate, ctrl.addToWishlist);
router.delete('/:bookId',        bookIdValidation, validate, ctrl.removeFromWishlist);
router.post('/:bookId/move-to-cart', bookIdValidation, validate, ctrl.moveToCart);
module.exports = router;
