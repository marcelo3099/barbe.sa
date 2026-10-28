const authService = require('../services/authService');
const { userJson } = require('../serializers');

async function register(req, res) {
  const user = await authService.register(req.body);
  res.status(201).json(userJson(user));
}

async function login(req, res) {
  const { token, user } = await authService.login(req.body);
  res.json({ token, user: userJson(user) });
}

async function me(req, res) {
  const user = await authService.me(req.user.id);
  res.json(userJson(user));
}

module.exports = { register, login, me };
