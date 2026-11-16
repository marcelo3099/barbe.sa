const { AppError } = require('../errors/AppError');
const { User } = require('../models');
const timeOffRepository = require('../repositories/timeOffRepository');
const appointmentRepository = require('../repositories/appointmentRepository');
const { appointmentJson } = require('../serializers');
const clock = require('../utils/clock');

async function list(actor, { barberId } = {}) {
  if (actor.role === 'BARBER') return timeOffRepository.list({ barberId: actor.id });
  return timeOffRepository.list({ barberId });
}

async function resolveBarberId(actor, body) {
  if (actor.role === 'BARBER') {
    if (body.barberId && body.barberId !== actor.id) throw AppError.of('FORBIDDEN');
    return actor.id;
  }

  if (!body.barberId) {
    throw AppError.of('VALIDATION_ERROR', { barberId: ['Informe o barbeiro'] });
  }
  const barber = await User.findOne({ where: { id: body.barberId, role: 'BARBER' } });
  if (!barber) throw AppError.of('NOT_FOUND', undefined, 'Barbeiro não encontrado');
  return barber.id;
}

async function create(actor, body) {
  const barberId = await resolveBarberId(actor, body);

  const overlapping = await appointmentRepository.findBusyForBarber({
    barberId,
    from: body.startsAt,
    to: body.endsAt,
  });
  const futureScheduled = overlapping.filter(
    (a) => a.status === 'SCHEDULED' && a.startsAt >= clock.now(),
  );
  if (futureScheduled.length > 0) {
    throw AppError.of('CONFLICTING_APPOINTMENTS', futureScheduled.map(appointmentJson));
  }

  return timeOffRepository.create({
    barberId,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    reason: body.reason || null,
  });
}

async function remove(actor, id) {
  const timeOff = await timeOffRepository.findById(id);
  if (!timeOff) throw AppError.of('NOT_FOUND', undefined, 'Bloqueio não encontrado');
  if (actor.role === 'BARBER' && timeOff.barberId !== actor.id) throw AppError.of('FORBIDDEN');
  await timeOffRepository.destroy(timeOff);
}

module.exports = { list, create, remove };
