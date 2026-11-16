const { DateTime } = require('luxon');
const { sequelize } = require('../models');
const { AppError } = require('../errors/AppError');
const businessHoursRepository = require('../repositories/businessHoursRepository');
const appointmentRepository = require('../repositories/appointmentRepository');
const { appointmentJson } = require('../serializers');
const { TZ, localDateOf, weekdayOf } = require('../utils/time');
const clock = require('../utils/clock');

const localTimeOf = (date) => DateTime.fromJSDate(date, { zone: TZ }).toFormat('HH:mm');

function fitsWithinHours(appointment, hours) {
  if (!hours || hours.closed) return false;
  const start = localTimeOf(appointment.startsAt);
  const end = localTimeOf(appointment.endsAt);
  if (start < hours.opensAt || end > hours.closesAt) return false;
  if (hours.breakStartsAt && hours.breakEndsAt) {
    if (start < hours.breakEndsAt && hours.breakStartsAt < end) return false;
  }
  return true;
}

async function getAll() {
  const rows = await businessHoursRepository.findAll();
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
  return Array.from({ length: 7 }, (_, weekday) =>
    byWeekday.get(weekday) || {
      weekday,
      opensAt: '00:00',
      closesAt: '00:00',
      breakStartsAt: null,
      breakEndsAt: null,
      closed: true,
    });
}

async function replace(rows) {
  return sequelize.transaction(async (t) => {
    const future = await appointmentRepository.findFutureScheduled({
      from: clock.now(),
      transaction: t,
    });
    const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
    const stillConflicting = future.filter((a) => {
      const weekday = weekdayOf(localDateOf(a.startsAt));
      return !fitsWithinHours(a, byWeekday.get(weekday));
    });
    if (stillConflicting.length > 0) {
      throw AppError.of('CONFLICTING_APPOINTMENTS', stillConflicting.map(appointmentJson));
    }
    await businessHoursRepository.replaceAll(rows, t);
    return businessHoursRepository.findAll({ transaction: t });
  });
}

module.exports = { getAll, replace };
