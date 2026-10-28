const {
  atLocal, localDateOf, addMinutes, addDaysToLocalDate, overlaps,
} = require('../utils/time');

const STEP_MINUTES = 15;
const MIN_LEAD_MINUTES = 30;
const MAX_DAYS_AHEAD = 60;

function computeSlots({ date, now, hours, durationMinutes, busy = [] }) {
  if (!hours || hours.closed) return [];

  const today = localDateOf(now);
  if (date < today || date > addDaysToLocalDate(today, MAX_DAYS_AHEAD)) return [];

  const earliest = addMinutes(now, MIN_LEAD_MINUTES);
  const opens = atLocal(date, hours.opensAt);
  const lastStart = addMinutes(atLocal(date, hours.closesAt), -durationMinutes);
  const hasBreak = hours.breakStartsAt && hours.breakEndsAt;
  const breakStart = hasBreak ? atLocal(date, hours.breakStartsAt) : null;
  const breakEnd = hasBreak ? atLocal(date, hours.breakEndsAt) : null;

  const slots = [];
  for (let s = opens; s <= lastStart; s = addMinutes(s, STEP_MINUTES)) {
    if (s < earliest) continue;
    const end = addMinutes(s, durationMinutes);
    if (hasBreak && overlaps(s, end, breakStart, breakEnd)) continue;
    if (busy.some((b) => overlaps(s, end, b.start, b.end))) continue;
    slots.push(s);
  }
  return slots;
}

const isSlotFree = (args, startsAt) =>
  computeSlots(args).some((s) => s.getTime() === startsAt.getTime());

module.exports = { computeSlots, isSlotFree };
