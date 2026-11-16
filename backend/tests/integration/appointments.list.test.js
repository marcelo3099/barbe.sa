const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService, createAppointment } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');

beforeEach(async () => {
  await resetDb();
  freezeNow(NOW);
});
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

describe('GET /api/appointments', () => {
  test('sem token -> 401', async () => {
    const res = await api.get('/api/appointments');
    expect(res.status).toBe(401);
  });

  test('cada perfil vê só o que pode; ordenação crescente por startsAt', async () => {
    const { user: clientA, token: tokenA } = await createUser({ role: 'CLIENT' });
    const { user: clientB } = await createUser({ role: 'CLIENT' });
    const { user: barber1, token: barber1Token } = await createUser({ role: 'BARBER' });
    const { user: barber2 } = await createUser({ role: 'BARBER' });
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const service = await createService({ durationMinutes: 30 });

    const a1 = await createAppointment({
      client: clientA,
      barber: barber1,
      service,
      startsAt: '2026-11-03T11:00:00-03:00',
    });
    const a2 = await createAppointment({
      client: clientA,
      barber: barber1,
      service,
      startsAt: '2026-11-03T09:00:00-03:00',
    });
    await createAppointment({
      client: clientB,
      barber: barber2,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });

    const clientRes = await api.get('/api/appointments').set('Authorization', auth(tokenA));
    expect(clientRes.body.map((a) => a.id)).toEqual([a2.id, a1.id]);

    const barberRes = await api
      .get(`/api/appointments?barberId=${barber2.id}`)
      .set('Authorization', auth(barber1Token));
    expect(barberRes.body.every((a) => a.barber.id === barber1.id)).toBe(true);

    const adminRes = await api
      .get(`/api/appointments?barberId=${barber2.id}`)
      .set('Authorization', auth(adminToken));
    expect(adminRes.body).toHaveLength(1);
    expect(adminRes.body[0].barber.id).toBe(barber2.id);
  });

  test('agendamento às 22:30 de SP aparece em from/to=03 e não em from=04 (virada de dia em UTC)', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });

    await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T22:30:00-03:00',
    });

    const sameDay = await api
      .get('/api/appointments?from=2026-11-03&to=2026-11-03')
      .set('Authorization', auth(barberToken));
    expect(sameDay.body).toHaveLength(1);

    const nextDay = await api
      .get('/api/appointments?from=2026-11-04')
      .set('Authorization', auth(barberToken));
    expect(nextDay.body).toHaveLength(0);
  });

  test('status inválido -> 400', async () => {
    const { token } = await createUser({ role: 'ADMIN' });
    const res = await api.get('/api/appointments?status=FOO').set('Authorization', auth(token));
    expect(res.status).toBe(400);
  });
});
