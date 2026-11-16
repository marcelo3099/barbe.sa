const { AppError } = require('../errors/AppError');
const { sequelize, User, Service } = require('../models');
const userRepository = require('../repositories/userRepository');
const appointmentRepository = require('../repositories/appointmentRepository');
const availabilityService = require('./availabilityService');
const { isSlotFree } = require('../domain/slots');
const { localDateOf, addMinutes } = require('../utils/time');

async function resolveClient(actor, body) {
  if (actor.role === 'CLIENT') {
    if (body.clientId && body.clientId !== actor.id) throw AppError.of('FORBIDDEN');
    return actor.id;
  }

  if (!body.clientId) {
    throw AppError.of('VALIDATION_ERROR', { clientId: ['Informe o cliente'] });
  }

  const client = await User.findOne({
    where: { id: body.clientId, role: 'CLIENT', active: true },
  });
  if (!client) throw AppError.of('NOT_FOUND', undefined, 'Cliente não encontrado');
  return client.id;
}

async function create(actor, body) {
  const clientId = await resolveClient(actor, body);

  if (actor.role === 'BARBER' && body.barberId !== actor.id) {
    throw AppError.of('FORBIDDEN');
  }

  const barber = await User.findOne({
    where: { id: body.barberId, role: 'BARBER', active: true },
  });
  if (!barber) throw AppError.of('NOT_FOUND', undefined, 'Barbeiro não encontrado');

  const service = await Service.findOne({ where: { id: body.serviceId, active: true } });
  if (!service) throw AppError.of('NOT_FOUND', undefined, 'Serviço não encontrado');

  const startsAt = body.startsAt;
  const endsAt = addMinutes(startsAt, service.durationMinutes);

  return sequelize.transaction(async (t) => {
    await userRepository.lockByIds([barber.id, clientId], t);

    const args = await availabilityService.getSlotArgs({
      barber,
      service,
      date: localDateOf(startsAt),
      transaction: t,
    });

    if (!isSlotFree(args, startsAt)) {
      throw AppError.of('SLOT_UNAVAILABLE', undefined, 'Este horário não está mais disponível');
    }

    const overlap = await appointmentRepository.findClientOverlap({
      clientId,
      startsAt,
      endsAt,
      transaction: t,
    });
    if (overlap) {
      throw AppError.of(
        'CLIENT_SCHEDULE_CONFLICT',
        undefined,
        'Você já tem um agendamento neste horário',
      );
    }

    const appointment = await appointmentRepository.create(
      {
        clientId,
        barberId: barber.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        priceCents: service.priceCents,
        status: 'SCHEDULED',
      },
      t,
    );

    return appointmentRepository.findByIdWithRelations(appointment.id, t);
  });
}

module.exports = { create };
