const jwt = require('jsonwebtoken');
const { AppError } = require('../errors/AppError');
const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');

const isTokenError = (err) =>
  err instanceof jwt.JsonWebTokenError ||
  err instanceof jwt.TokenExpiredError ||
  err instanceof jwt.NotBeforeError;

// Returns { id, role } from the database, or null when the token is missing/invalid.
// Unexpected errors (e.g. database failures) propagate to the caller.
async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (isTokenError(err)) return null;
    throw err;
  }
  if (!Number.isInteger(payload.sub)) return null;
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.active) return null;
  return { id: user.id, role: user.role };
}

async function authenticate(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return next(AppError.of('UNAUTHORIZED'));
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authenticate, resolveUser };
