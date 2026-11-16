const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const {
  idParamSchema,
  createTimeOffSchema,
  listTimeOffQuerySchema,
} = require('../schemas/timeOff.schemas');
const timeOffController = require('../controllers/timeOffController');

const router = Router();

router.use(authenticate, authorize('BARBER', 'ADMIN'));

router.get('/', validate({ query: listTimeOffQuerySchema }), timeOffController.list);
router.post('/', validate({ body: createTimeOffSchema }), timeOffController.create);
router.delete('/:id', validate({ params: idParamSchema }), timeOffController.remove);

module.exports = router;
