const { resolveUser } = require('./authenticate');

async function optionalAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (user) req.user = user;
  } catch {
    // optional: any failure means "anonymous"
  }
  return next();
}

module.exports = { optionalAuth };
