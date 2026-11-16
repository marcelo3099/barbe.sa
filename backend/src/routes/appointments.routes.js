const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { createAppointmentSchema } = require('../schemas/appointment.schemas');
const appointmentController = require('../controllers/appointmentController');

const router = Router();

router.post(
  '/',
  authenticate,
  validate({ body: createAppointmentSchema }),
  appointmentController.create,
);

module.exports = router;
