const { AppError } = require('../errors/AppError');
const { User, Service } = require('../models');
const businessHoursRepository = require('../repositories/businessHoursRepository');
const appointmentRepository = require('../repositories/appointmentRepository');
const timeOffRepository = require('../repositories/timeOffRepository');
const { computeSlots } = require('../domain/slots');
const { weekdayOf, startOfLocalDay, endOfLocalDay, toIso } = require('../utils/time');
const clock = require('../utils/clock');

async function getSlotArgs({ barber, service, date, transaction }) {
  const weekday = weekdayOf(date);
  const hours = await businessHoursRepository.findByWeekday(weekday);
  const from = startOfLocalDay(date);
  const to = endOfLocalDay(date);

  const [appointments, timeOffs] = await Promise.all([
    appointmentRepository.findBusyForBarber({ barberId: barber.id, from, to, transaction }),
    timeOffRepository.findOverlapping({ barberId: barber.id, from, to, transaction }),
  ]);

  const busy = [
    ...appointments.map((a) => ({ start: a.startsAt, end: a.endsAt })),
    ...timeOffs.map((t) => ({ start: t.startsAt, end: t.endsAt })),
  ];

  return {
    date,
    now: clock.now(),
    hours: hours || null,
    durationMinutes: service.durationMinutes,
    busy,
  };
}

async function getAvailability({ barberId, serviceId, date }) {
  const barber = await User.findOne({ where: { id: barberId, role: 'BARBER' } });
  if (!barber) throw AppError.of('NOT_FOUND', undefined, 'Barbeiro não encontrado');

  const service = await Service.findByPk(serviceId);
  if (!service) throw AppError.of('NOT_FOUND', undefined, 'Serviço não encontrado');

  if (!barber.active || !service.active) return { date, slots: [] };

  const args = await getSlotArgs({ barber, service, date });
  const slots = computeSlots(args);
  return { date, slots: slots.map(toIso) };
}

module.exports = { getSlotArgs, getAvailability };
