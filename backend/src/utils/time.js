const { DateTime } = require('luxon');

const TZ = 'America/Sao_Paulo';

const local = (date, hhmm = '00:00') => DateTime.fromISO(`${date}T${hhmm}`, { zone: TZ });

const toIso = (date) =>
  DateTime.fromJSDate(date, { zone: TZ }).toISO({ suppressMilliseconds: true });

const localDateOf = (date) => DateTime.fromJSDate(date, { zone: TZ }).toFormat('yyyy-MM-dd');

const atLocal = (date, hhmm) => local(date, hhmm).toJSDate();

// Domingo = 0 .. sábado = 6
const weekdayOf = (date) => local(date).weekday % 7;

const startOfLocalDay = (date) => local(date).startOf('day').toJSDate();

// Início do dia seguinte (limite exclusivo)
const endOfLocalDay = (date) => local(date).plus({ days: 1 }).startOf('day').toJSDate();

const addMinutes = (date, n) => new Date(date.getTime() + n * 60000);

const addDaysToLocalDate = (date, n) => local(date).plus({ days: n }).toFormat('yyyy-MM-dd');

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

module.exports = {
  TZ, toIso, localDateOf, atLocal, weekdayOf, startOfLocalDay, endOfLocalDay,
  addMinutes, addDaysToLocalDate, overlaps,
};
