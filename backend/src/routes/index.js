const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const servicesRoutes = require('./services.routes');
const barbersRoutes = require('./barbers.routes');
const businessHoursRoutes = require('./businessHours.routes');
const availabilityRoutes = require('./availability.routes');
const appointmentsRoutes = require('./appointments.routes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/services', servicesRoutes);
router.use('/barbers', barbersRoutes);
router.use('/business-hours', businessHoursRoutes);
router.use('/availability', availabilityRoutes);
router.use('/appointments', appointmentsRoutes);

module.exports = router;
