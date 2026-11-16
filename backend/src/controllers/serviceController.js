const serviceService = require('../services/serviceService');
const { serviceJson } = require('../serializers');

async function list(req, res) {
  const includeInactive = req.user?.role === 'ADMIN' && req.validatedQuery?.includeInactive === true;
  const services = await serviceService.list({ includeInactive });
  res.json(services.map(serviceJson));
}

async function create(req, res) {
  const service = await serviceService.create(req.body);
  res.status(201).json(serviceJson(service));
}

async function update(req, res) {
  const service = await serviceService.update(req.params.id, req.body);
  res.json(serviceJson(service));
}

async function remove(req, res) {
  const service = await serviceService.deactivate(req.params.id);
  res.json(serviceJson(service));
}

module.exports = { list, create, update, remove };
