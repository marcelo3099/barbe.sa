const { AppError } = require('../errors/AppError');
const userRepository = require('../repositories/userRepository');
const appointmentRepository = require('../repositories/appointmentRepository');
const { hashPassword } = require('../utils/password');
const { appointmentJson } = require('../serializers');
const clock = require('../utils/clock');

const list = ({ role } = {}) => userRepository.list({ role });

async function create(data) {
  const passwordHash = await hashPassword(data.password);
  try {
    return await userRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash,
      role: data.role,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw AppError.of('EMAIL_IN_USE');
    throw err;
  }
}

async function assertNoConflict(user, data) {
  if (user.role !== 'BARBER') return;
  const demoting = data.role && data.role !== 'BARBER';
  const deactivating = data.active === false;
  if (!demoting && !deactivating) return;

  const future = await appointmentRepository.findFutureScheduled({
    barberId: user.id,
    from: clock.now(),
  });
  if (future.length > 0) {
    throw AppError.of('CONFLICTING_APPOINTMENTS', future.map(appointmentJson));
  }
}

async function update(actorId, id, data) {
  const user = await userRepository.findById(id);
  if (!user) throw AppError.of('NOT_FOUND', undefined, 'Usuário não encontrado');

  if (actorId === id) {
    if (data.active === false) throw AppError.of('CANNOT_MODIFY_SELF');
    if (data.role && data.role !== user.role) throw AppError.of('CANNOT_MODIFY_SELF');
  }

  await assertNoConflict(user, data);

  const patch = { ...data };
  if (patch.password) {
    patch.passwordHash = await hashPassword(patch.password);
    delete patch.password;
  }

  try {
    return await userRepository.update(user, patch);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw AppError.of('EMAIL_IN_USE');
    throw err;
  }
}

module.exports = { list, create, update };
