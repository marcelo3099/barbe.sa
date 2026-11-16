const userService = require('../services/userService');
const { userJson } = require('../serializers');

async function list(req, res) {
  const users = await userService.list(req.validatedQuery || {});
  res.json(users.map(userJson));
}

async function create(req, res) {
  const user = await userService.create(req.body);
  res.status(201).json(userJson(user));
}

async function update(req, res) {
  const user = await userService.update(req.user.id, req.params.id, req.body);
  res.json(userJson(user));
}

module.exports = { list, create, update };
