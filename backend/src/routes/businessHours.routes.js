const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { businessHoursSchema } = require('../schemas/businessHours.schemas');
const businessHoursController = require('../controllers/businessHoursController');

const router = Router();

router.get('/', businessHoursController.get);
router.put(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: businessHoursSchema }),
  businessHoursController.put,
);

module.exports = router;
