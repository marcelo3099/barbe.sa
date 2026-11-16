const { toIso } = require('../utils/time');

const userJson = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  active: user.active,
});

const appointmentJson = (a) => ({
  id: a.id,
  status: a.status,
  startsAt: toIso(a.startsAt),
  endsAt: toIso(a.endsAt),
  priceCents: a.priceCents,
  paymentMethod: a.paymentMethod ?? null,
  paidAt: a.paidAt ? toIso(a.paidAt) : null,
  canceledAt: a.canceledAt ? toIso(a.canceledAt) : null,
  cancelReason: a.cancelReason ?? null,
  client: { id: a.client.id, name: a.client.name, phone: a.client.phone },
  barber: { id: a.barber.id, name: a.barber.name },
  service: { id: a.service.id, name: a.service.name, durationMinutes: a.service.durationMinutes },
});

module.exports = { userJson, appointmentJson };
