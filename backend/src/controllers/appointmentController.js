const appointmentService = require('../services/appointmentService');
const { appointmentJson } = require('../serializers');

async function create(req, res) {
  const appointment = await appointmentService.create(req.user, req.body);
  res.status(201).json(appointmentJson(appointment));
}

async function list(req, res) {
  const appointments = await appointmentService.list(req.user, req.validatedQuery || {});
  res.json(appointments.map(appointmentJson));
}

async function cancel(req, res) {
  const appointment = await appointmentService.cancel(req.user, req.params.id, req.body);
  res.json(appointmentJson(appointment));
}

async function complete(req, res) {
  const appointment = await appointmentService.complete(req.user, req.params.id, req.body);
  res.json(appointmentJson(appointment));
}

async function noShow(req, res) {
  const appointment = await appointmentService.noShow(req.user, req.params.id);
  res.json(appointmentJson(appointment));
}

module.exports = { create, list, cancel, complete, noShow };
