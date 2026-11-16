const { Router } = require('express');
const barberController = require('../controllers/barberController');

const router = Router();

router.get('/', barberController.list);

module.exports = router;
