const businessHoursService = require('../services/businessHoursService');
const { businessHoursJson } = require('../serializers');

async function get(req, res) {
  const rows = await businessHoursService.getAll();
  res.json(rows.map(businessHoursJson));
}

async function put(req, res) {
  const rows = await businessHoursService.replace(req.body);
  res.json(rows.map(businessHoursJson));
}

module.exports = { get, put };
