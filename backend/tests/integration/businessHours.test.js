const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService, setDefaultHours } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');
const { Appointment } = require('../../src/models');

beforeEach(resetDb);
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

const sevenDays = () =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: '09:00',
    closesAt: '18:00',
    breakStartsAt: '12:00',
    breakEndsAt: '13:00',
    closed: false,
  }));

describe('GET /api/business-hours', () => {
  test('sem token -> 200 com 7 itens, mesmo com a tabela vazia', async () => {
    const res = await api.get('/api/business-hours');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    res.body.forEach((row) => expect(row.closed).toBe(true));
  });

  test('reflete o que foi configurado', async () => {
    await setDefaultHours();
    const res = await api.get('/api/business-hours');
    const tuesday = res.body.find((r) => r.weekday === 2);
    expect(tuesday).toEqual({
      weekday: 2,
      opensAt: '09:00',
      closesAt: '18:00',
      breakStartsAt: '12:00',
      breakEndsAt: '13:00',
      closed: false,
    });
  });
});

describe('PUT /api/business-hours', () => {
  test('sem token -> 401; BARBER/CLIENT -> 403', async () => {
    const { token: barberToken } = await createUser({ role: 'BARBER' });
    const { token: clientToken } = await createUser({ role: 'CLIENT' });
    const rows = sevenDays();

    expect((await api.put('/api/business-hours').send(rows)).status).toBe(401);
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(barberToken)).send(rows)).status,
    ).toBe(403);
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(clientToken)).send(rows)).status,
    ).toBe(403);
  });

  test('ADMIN envia PUT válido -> 200 e o GET seguinte reflete', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const rows = sevenDays();
    rows[0] = { weekday: 0, opensAt: '00:00', closesAt: '00:00', closed: true };

    const res = await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(rows);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);

    const get = await api.get('/api/business-hours');
    expect(get.body.find((r) => r.weekday === 1).opensAt).toBe('09:00');
  });

  test('valores de borda -> 400', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });

    const sixRows = sevenDays().slice(0, 6);
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(sixRows)).status,
    ).toBe(400);

    const repeatedWeekday = sevenDays();
    repeatedWeekday[1] = { ...repeatedWeekday[1], weekday: 2 };
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(repeatedWeekday))
        .status,
    ).toBe(400);

    const invertedHours = sevenDays();
    invertedHours[2] = { ...invertedHours[2], opensAt: '18:00', closesAt: '09:00' };
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(invertedHours))
        .status,
    ).toBe(400);

    const offGrid = sevenDays();
    offGrid[2] = { ...offGrid[2], opensAt: '09:10' };
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(offGrid)).status,
    ).toBe(400);

    const onlyBreakStart = sevenDays();
    onlyBreakStart[2] = { ...onlyBreakStart[2], breakStartsAt: '12:00', breakEndsAt: null };
    expect(
      (await api.put('/api/business-hours').set('Authorization', auth(adminToken)).send(onlyBreakStart))
        .status,
    ).toBe(400);
  });

  test('bloqueia alterações que deixariam agendamento futuro fora do expediente', async () => {
    freezeNow(NOW);
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: client } = await createUser({ role: 'CLIENT' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    await Appointment.create({
      clientId: client.id,
      barberId: barber.id,
      serviceId: service.id,
      startsAt: new Date('2026-11-03T17:00:00-03:00'),
      endsAt: new Date('2026-11-03T17:30:00-03:00'),
      priceCents: service.priceCents,
      status: 'SCHEDULED',
    });

    const closingTuesday = sevenDays();
    closingTuesday[2] = { weekday: 2, opensAt: '00:00', closesAt: '00:00', closed: true };
    const closeRes = await api
      .put('/api/business-hours')
      .set('Authorization', auth(adminToken))
      .send(closingTuesday);
    expect(closeRes.status).toBe(409);
    expect(closeRes.body.error.code).toBe('CONFLICTING_APPOINTMENTS');

    const shrinkingTuesday = sevenDays();
    shrinkingTuesday[2] = { ...shrinkingTuesday[2], opensAt: '09:00', closesAt: '17:00' };
    const shrinkRes = await api
      .put('/api/business-hours')
      .set('Authorization', auth(adminToken))
      .send(shrinkingTuesday);
    expect(shrinkRes.status).toBe(409);

    const movingBreak = sevenDays();
    movingBreak[2] = { ...movingBreak[2], breakStartsAt: '17:00', breakEndsAt: '17:30' };
    const breakRes = await api
      .put('/api/business-hours')
      .set('Authorization', auth(adminToken))
      .send(movingBreak);
    expect(breakRes.status).toBe(409);

    const closingWednesday = sevenDays();
    closingWednesday[3] = { weekday: 3, opensAt: '00:00', closesAt: '00:00', closed: true };
    const okRes = await api
      .put('/api/business-hours')
      .set('Authorization', auth(adminToken))
      .send(closingWednesday);
    expect(okRes.status).toBe(200);
  });
});
