const appointmentService = require('../services/appointmentService');
const { appointmentJson } = require('../serializers');

async function create(req, res) {
  const appointment = await appointmentService.create(req.user, req.body);
  res.status(201).json(appointmentJson(appointment));
}

module.exports = { create };
