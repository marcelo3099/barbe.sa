const { hashPassword } = require('../../src/utils/password');
const { signToken } = require('../../src/utils/jwt');
const { User, Service, BusinessHours, TimeOff, Appointment } = require('../../src/models');

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return sequence;
};

async function createUser({
  role = 'CLIENT',
  name,
  email,
  password = 'senha1234',
  active = true,
  phone,
} = {}) {
  const n = nextId();
  const user = await User.create({
    name: name || `Usuario ${n}`,
    email: email || `user${n}@example.com`,
    phone: phone || null,
    passwordHash: await hashPassword(password),
    role,
    active,
  });
  return { user, password, token: signToken(user) };
}

function createService({
  name = 'Corte clássico',
  priceCents = 4500,
  durationMinutes = 30,
  active = true,
  description = '',
} = {}) {
  return Service.create({ name, priceCents, durationMinutes, active, description });
}

async function setDefaultHours() {
  const rows = [{ weekday: 0, opensAt: '00:00', closesAt: '00:00', closed: true }];
  for (let weekday = 1; weekday <= 6; weekday += 1) {
    rows.push({
      weekday,
      opensAt: '09:00',
      closesAt: '18:00',
      breakStartsAt: '12:00',
      breakEndsAt: '13:00',
      closed: false,
    });
  }
  await BusinessHours.destroy({ where: {} });
  return BusinessHours.bulkCreate(rows);
}

function createAppointment({ client, barber, service, startsAt, status = 'SCHEDULED' }) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
  return Appointment.create({
    clientId: client.id,
    barberId: barber.id,
    serviceId: service.id,
    startsAt: start,
    endsAt: end,
    priceCents: service.priceCents,
    status,
  });
}

function createTimeOff({ barber, startsAt, endsAt, reason = null }) {
  return TimeOff.create({
    barberId: barber.id,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    reason,
  });
}

module.exports = {
  createUser,
  createService,
  setDefaultHours,
  createAppointment,
  createTimeOff,
};
