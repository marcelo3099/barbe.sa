const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);

module.exports = router;
