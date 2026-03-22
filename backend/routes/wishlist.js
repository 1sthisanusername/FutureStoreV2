const router = require('express').Router();
const ctrl   = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/',                  ctrl.getWishlist);
router.post('/:bookId',          ctrl.addToWishlist);
router.delete('/:bookId',        ctrl.removeFromWishlist);
router.post('/:bookId/move-to-cart', ctrl.moveToCart);
module.exports = router;
