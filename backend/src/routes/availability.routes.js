const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { availabilityQuerySchema } = require('../schemas/availability.schemas');
const availabilityController = require('../controllers/availabilityController');

const router = Router();

router.get('/', validate({ query: availabilityQuerySchema }), availabilityController.get);

module.exports = router;
