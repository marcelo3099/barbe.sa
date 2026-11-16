const availabilityService = require('../services/availabilityService');

async function get(req, res) {
  const { barberId, serviceId, date } = req.validatedQuery;
  const result = await availabilityService.getAvailability({ barberId, serviceId, date });
  res.json(result);
}

module.exports = { get };
