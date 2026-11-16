const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService, setDefaultHours } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');
const { Appointment } = require('../../src/models');

beforeEach(async () => {
  await resetDb();
  freezeNow(NOW);
  await setDefaultHours();
});
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

async function setup() {
  const { user: client, token: clientToken } = await createUser({ role: 'CLIENT' });
  const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
  const { token: adminToken } = await createUser({ role: 'ADMIN' });
  const service = await createService({ durationMinutes: 30, priceCents: 4500 });
  return { client, clientToken, barber, barberToken, adminToken, service };
}

describe('POST /api/appointments', () => {
  test('sem token -> 401', async () => {
    const res = await api.post('/api/appointments').send({});
    expect(res.status).toBe(401);
  });

  test('CLIENT reserva um horário -> 201 no formato 7.1', async () => {
    const { client, clientToken, barber, service } = await setup();

    const res = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({
        serviceId: service.id,
        barberId: barber.id,
        startsAt: '2026-11-03T10:00:00-03:00',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      status: 'SCHEDULED',
      startsAt: '2026-11-03T10:00:00-03:00',
      endsAt: '2026-11-03T10:30:00-03:00',
      priceCents: 4500,
      paymentMethod: null,
      paidAt: null,
      canceledAt: null,
      cancelReason: null,
      client: { id: client.id, name: client.name, phone: client.phone },
      barber: { id: barber.id, name: barber.name },
      service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
    });
  });

  test('aceita startsAt em UTC e devolve no fuso de SP; sem offset -> 400', async () => {
    const { clientToken, barber, service } = await setup();

    const res = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T13:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.startsAt).toBe('2026-11-03T10:00:00-03:00');

    const noOffset = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-04T10:00:00' });
    expect(noOffset.status).toBe(400);
  });

  test('mesmo horário para outro cliente -> 409 SLOT_UNAVAILABLE; horário sobreposto -> 409; seguinte -> 201', async () => {
    const { clientToken, barber, service } = await setup();
    const { token: otherClientToken } = await createUser({ role: 'CLIENT' });

    const first = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(first.status).toBe(201);

    const sameSlot = await api
      .post('/api/appointments')
      .set('Authorization', auth(otherClientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(sameSlot.status).toBe(409);
    expect(sameSlot.body.error.code).toBe('SLOT_UNAVAILABLE');

    const overlapping = await api
      .post('/api/appointments')
      .set('Authorization', auth(otherClientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:15:00-03:00' });
    expect(overlapping.status).toBe(409);

    const next = await api
      .post('/api/appointments')
      .set('Authorization', auth(otherClientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:30:00-03:00' });
    expect(next.status).toBe(201);
  });

  test('fora do expediente, almoço, fora da grade, domingo, antecedência e limite de 60 dias -> 409', async () => {
    const { clientToken, barber, service } = await setup();
    const cases = [
      '2026-11-03T08:00:00-03:00',
      '2026-11-03T12:00:00-03:00',
      '2026-11-03T10:05:00-03:00',
      '2026-11-08T10:00:00-03:00',
      '2026-11-02T08:10:00-03:00',
      '2027-02-01T10:00:00-03:00',
    ];
    for (const startsAt of cases) {
      const res = await api
        .post('/api/appointments')
        .set('Authorization', auth(clientToken))
        .send({ serviceId: service.id, barberId: barber.id, startsAt });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    }
  });

  test('mesmo cliente com outro barbeiro no mesmo horário -> 409 CLIENT_SCHEDULE_CONFLICT', async () => {
    const { clientToken, barber, service } = await setup();
    const { user: otherBarber } = await createUser({ role: 'BARBER' });

    const first = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(first.status).toBe(201);

    const second = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: otherBarber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CLIENT_SCHEDULE_CONFLICT');
  });

  test('alterar o preço do serviço depois não afeta agendamentos já criados', async () => {
    const { clientToken, barber, service } = await setup();

    const res = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(res.status).toBe(201);

    await service.update({ priceCents: 9999 });

    const appointment = await Appointment.findByPk(res.body.id);
    expect(appointment.priceCents).toBe(4500);
  });

  test('regras de papel: CLIENT com clientId de outro -> 403; BARBER sem clientId -> 400; BARBER agenda própria com clientId -> 201; BARBER com barberId de outro -> 403; ADMIN com clientId de um BARBER -> 404; serviço inativo -> 404', async () => {
    const { client, clientToken, barber, barberToken, adminToken, service } = await setup();
    const { user: otherClient } = await createUser({ role: 'CLIENT' });
    const { user: otherBarber } = await createUser({ role: 'BARBER' });

    const clientWithOtherId = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({
        serviceId: service.id,
        barberId: barber.id,
        clientId: otherClient.id,
        startsAt: '2026-11-03T10:00:00-03:00',
      });
    expect(clientWithOtherId.status).toBe(403);

    const barberWithoutClient = await api
      .post('/api/appointments')
      .set('Authorization', auth(barberToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T10:00:00-03:00' });
    expect(barberWithoutClient.status).toBe(400);
    expect(barberWithoutClient.body.error.details.clientId).toBeDefined();

    const barberOwnAgenda = await api
      .post('/api/appointments')
      .set('Authorization', auth(barberToken))
      .send({
        serviceId: service.id,
        barberId: barber.id,
        clientId: client.id,
        startsAt: '2026-11-03T10:00:00-03:00',
      });
    expect(barberOwnAgenda.status).toBe(201);

    const barberOtherBarber = await api
      .post('/api/appointments')
      .set('Authorization', auth(barberToken))
      .send({
        serviceId: service.id,
        barberId: otherBarber.id,
        clientId: client.id,
        startsAt: '2026-11-03T11:00:00-03:00',
      });
    expect(barberOtherBarber.status).toBe(403);

    const adminWithBarberAsClient = await api
      .post('/api/appointments')
      .set('Authorization', auth(adminToken))
      .send({
        serviceId: service.id,
        barberId: barber.id,
        clientId: otherBarber.id,
        startsAt: '2026-11-03T11:00:00-03:00',
      });
    expect(adminWithBarberAsClient.status).toBe(404);

    await service.update({ active: false });
    const inactiveService = await api
      .post('/api/appointments')
      .set('Authorization', auth(clientToken))
      .send({ serviceId: service.id, barberId: barber.id, startsAt: '2026-11-03T13:00:00-03:00' });
    expect(inactiveService.status).toBe(404);
  });

  test('concorrência: duas reservas simultâneas no mesmo horário -> um 201 e um 409, apenas um registro', async () => {
    const { barber, service } = await setup();
    const { token: clientAToken } = await createUser({ role: 'CLIENT' });
    const { token: clientBToken } = await createUser({ role: 'CLIENT' });

    const payload = {
      serviceId: service.id,
      barberId: barber.id,
      startsAt: '2026-11-03T10:00:00-03:00',
    };

    const [resA, resB] = await Promise.all([
      api.post('/api/appointments').set('Authorization', auth(clientAToken)).send(payload),
      api.post('/api/appointments').set('Authorization', auth(clientBToken)).send(payload),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await Appointment.count();
    expect(count).toBe(1);
  });
});
