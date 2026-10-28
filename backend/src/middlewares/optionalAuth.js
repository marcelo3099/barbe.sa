const { resolveUser } = require('./authenticate');

async function optionalAuth(req, res, next) {
  const { user } = await resolveUser(req);
  if (user) req.user = user;
  return next();
}

module.exports = { optionalAuth };
