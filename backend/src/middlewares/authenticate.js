const { AppError } = require('../errors/AppError');
const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');

// Returns { id, role } from the database, or null when the token is missing/invalid.
async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return { user: null };
  try {
    const payload = verifyToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user || !user.active) return { user: null };
    return { user: { id: user.id, role: user.role } };
  } catch {
    return { user: null };
  }
}

async function authenticate(req, res, next) {
  const { user } = await resolveUser(req);
  if (!user) return next(AppError.of('UNAUTHORIZED'));
  req.user = user;
  return next();
}

module.exports = { authenticate, resolveUser };
