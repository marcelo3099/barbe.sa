const { AppError } = require('../errors/AppError');
const userRepository = require('../repositories/userRepository');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

async function register({ name, email, password, phone }) {
  if (await userRepository.findByEmail(email)) throw AppError.of('EMAIL_IN_USE');
  const passwordHash = await hashPassword(password);
  try {
    return await userRepository.create({
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: 'CLIENT',
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw AppError.of('EMAIL_IN_USE');
    throw err;
  }
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  const ok = user ? await comparePassword(password, user.passwordHash) : false;
  if (!user || !ok || !user.active) throw AppError.of('INVALID_CREDENTIALS');
  return { token: signToken(user), user };
}

async function me(userId) {
  const user = await userRepository.findById(userId);
  if (!user || !user.active) throw AppError.of('UNAUTHORIZED');
  return user;
}

module.exports = { register, login, me };
