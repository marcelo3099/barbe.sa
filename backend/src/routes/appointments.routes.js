const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const {
  idParamSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  cancelAppointmentSchema,
  completeAppointmentSchema,
} = require('../schemas/appointment.schemas');
const appointmentController = require('../controllers/appointmentController');

const router = Router();

router.get(
  '/',
  authenticate,
  validate({ query: listAppointmentsQuerySchema }),
  appointmentController.list,
);
router.post(
  '/',
  authenticate,
  validate({ body: createAppointmentSchema }),
  appointmentController.create,
);
router.patch(
  '/:id/cancel',
  authenticate,
  validate({ params: idParamSchema, body: cancelAppointmentSchema }),
  appointmentController.cancel,
);
router.patch(
  '/:id/complete',
  authenticate,
  authorize('BARBER', 'ADMIN'),
  validate({ params: idParamSchema, body: completeAppointmentSchema }),
  appointmentController.complete,
);
router.patch(
  '/:id/no-show',
  authenticate,
  authorize('BARBER', 'ADMIN'),
  validate({ params: idParamSchema }),
  appointmentController.noShow,
);

module.exports = router;
