const TZ = "America/Sao_Paulo";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });
const dayMonthFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatTime(iso) {
  return timeFmt.format(new Date(iso));
}

export function formatDate(iso) {
  const d = new Date(iso);
  return `${weekdayFmt.format(d)}, ${dayMonthFmt.format(d)}`;
}

export function todayISODate(now = new Date()) {
  return ymdFmt.format(now);
}

export function dayRange(date) {
  return { from: `${date}T00:00:00-03:00`, to: `${date}T23:59:59-03:00` };
}
