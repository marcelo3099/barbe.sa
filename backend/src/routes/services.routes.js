const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { optionalAuth } = require('../middlewares/optionalAuth');
const {
  idParamSchema,
  listServicesQuerySchema,
  createServiceSchema,
  updateServiceSchema,
} = require('../schemas/service.schemas');
const serviceController = require('../controllers/serviceController');

const router = Router();

router.get(
  '/',
  optionalAuth,
  validate({ query: listServicesQuerySchema }),
  serviceController.list,
);
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: createServiceSchema }),
  serviceController.create,
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: updateServiceSchema }),
  serviceController.update,
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParamSchema }),
  serviceController.remove,
);

module.exports = router;
