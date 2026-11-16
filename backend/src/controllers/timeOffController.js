const timeOffService = require('../services/timeOffService');
const { timeOffJson } = require('../serializers');

async function list(req, res) {
  const items = await timeOffService.list(req.user, req.validatedQuery || {});
  res.json(items.map(timeOffJson));
}

async function create(req, res) {
  const item = await timeOffService.create(req.user, req.body);
  res.status(201).json(timeOffJson(item));
}

async function remove(req, res) {
  await timeOffService.remove(req.user, req.params.id);
  res.status(204).send();
}

module.exports = { list, create, remove };
