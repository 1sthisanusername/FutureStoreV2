const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/addressController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sanitizeBody } = require('../middleware/sanitize');

router.use(authenticate, sanitizeBody);

const addrValidation = [
  body('name').trim().escape().notEmpty().isLength({ max: 120 }),
  body('phone').optional().trim().isLength({ max: 30 }).matches(/^[+\d\s()-]{7,30}$/),
  body('line1').trim().escape().notEmpty().isLength({ max: 255 }),
  body('line2').optional().trim().escape().isLength({ max: 255 }),
  body('city').trim().escape().notEmpty().isLength({ max: 100 }),
  body('state').trim().escape().notEmpty().isLength({ max: 100 }),
  body('pincode').trim().notEmpty().isLength({ min: 4, max: 20 }).matches(/^[A-Z0-9 -]+$/i),
  body('country').optional().trim().escape().isLength({ max: 80 }),
  body('label').optional().trim().escape().isLength({ max: 60 }),
  body('is_default').optional().isBoolean(),
];

router.get('/',       ctrl.getAddresses);
router.post('/',      addrValidation, validate, ctrl.addAddress);
router.put('/:id',    addrValidation, validate, ctrl.updateAddress);
router.delete('/:id', ctrl.deleteAddress);

module.exports = router;
