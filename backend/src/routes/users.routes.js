const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const {
  idParamSchema,
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
} = require('../schemas/user.schemas');
const userController = require('../controllers/userController');

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', validate({ query: listUsersQuerySchema }), userController.list);
router.post('/', validate({ body: createUserSchema }), userController.create);
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateUserSchema }),
  userController.update,
);

module.exports = router;
