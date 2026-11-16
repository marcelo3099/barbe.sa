const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const {
  createUser,
  createService,
  createAppointment,
  setDefaultHours,
} = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');

beforeEach(async () => {
  await resetDb();
  freezeNow(NOW);
});
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

describe('GET/POST/DELETE /api/time-off', () => {
  test('sem token -> 401 nas três; CLIENT -> 403 nas três', async () => {
    const { token: clientToken } = await createUser({ role: 'CLIENT' });
    const body = { startsAt: '2026-11-03T12:00:00-03:00', endsAt: '2026-11-03T13:00:00-03:00' };

    expect((await api.get('/api/time-off')).status).toBe(401);
    expect((await api.post('/api/time-off').send(body)).status).toBe(401);
    expect((await api.delete('/api/time-off/1')).status).toBe(401);

    expect((await api.get('/api/time-off').set('Authorization', auth(clientToken))).status).toBe(403);
    expect(
      (await api.post('/api/time-off').set('Authorization', auth(clientToken)).send(body)).status,
    ).toBe(403);
    expect(
      (await api.delete('/api/time-off/1').set('Authorization', auth(clientToken))).status,
    ).toBe(403);
  });

  test('BARBER cria para si; com barberId de outro -> 403; GET não traz de outro; DELETE de outro -> 403; próprio -> 204', async () => {
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const { user: otherBarber, token: otherBarberToken } = await createUser({ role: 'BARBER' });

    const res = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T12:00:00-03:00', endsAt: '2026-11-03T13:00:00-03:00' });
    expect(res.status).toBe(201);
    expect(res.body.barberId).toBe(barber.id);

    const forbidden = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({
        barberId: otherBarber.id,
        startsAt: '2026-11-04T12:00:00-03:00',
        endsAt: '2026-11-04T13:00:00-03:00',
      });
    expect(forbidden.status).toBe(403);

    const otherTimeOff = await api
      .post('/api/time-off')
      .set('Authorization', auth(otherBarberToken))
      .send({ startsAt: '2026-11-05T12:00:00-03:00', endsAt: '2026-11-05T13:00:00-03:00' });

    const list = await api.get('/api/time-off').set('Authorization', auth(barberToken));
    expect(list.body.every((t) => t.barberId === barber.id)).toBe(true);

    const deleteOthers = await api
      .delete(`/api/time-off/${otherTimeOff.body.id}`)
      .set('Authorization', auth(barberToken));
    expect(deleteOthers.status).toBe(403);

    const deleteOwn = await api
      .delete(`/api/time-off/${res.body.id}`)
      .set('Authorization', auth(barberToken));
    expect(deleteOwn.status).toBe(204);

    const notFound = await api.delete('/api/time-off/9999').set('Authorization', auth(barberToken));
    expect(notFound.status).toBe(404);
  });

  test('ADMIN cria com barberId; sem barberId -> 400; GET filtra por barberId', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: otherBarber } = await createUser({ role: 'BARBER' });

    const created = await api
      .post('/api/time-off')
      .set('Authorization', auth(adminToken))
      .send({ barberId: barber.id, startsAt: '2026-11-03T12:00:00-03:00', endsAt: '2026-11-03T13:00:00-03:00' });
    expect(created.status).toBe(201);

    const missing = await api
      .post('/api/time-off')
      .set('Authorization', auth(adminToken))
      .send({ startsAt: '2026-11-04T12:00:00-03:00', endsAt: '2026-11-04T13:00:00-03:00' });
    expect(missing.status).toBe(400);

    await api
      .post('/api/time-off')
      .set('Authorization', auth(adminToken))
      .send({ barberId: otherBarber.id, startsAt: '2026-11-05T12:00:00-03:00', endsAt: '2026-11-05T13:00:00-03:00' });

    const filtered = await api
      .get(`/api/time-off?barberId=${barber.id}`)
      .set('Authorization', auth(adminToken));
    expect(filtered.body.every((t) => t.barberId === barber.id)).toBe(true);

    const all = await api.get('/api/time-off').set('Authorization', auth(adminToken));
    expect(all.body.length).toBeGreaterThanOrEqual(2);
  });

  test('endsAt <= startsAt -> 400; sem offset -> 400', async () => {
    const { token: barberToken } = await createUser({ role: 'BARBER' });

    const invertedRes = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T13:00:00-03:00', endsAt: '2026-11-03T12:00:00-03:00' });
    expect(invertedRes.status).toBe(400);

    const noOffsetRes = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T12:00:00', endsAt: '2026-11-03T13:00:00' });
    expect(noOffsetRes.status).toBe(400);
  });

  test('bloqueio sobre SCHEDULED futuro -> 409; sobre CANCELED -> 201; bloqueio encostado -> 201', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });

    const scheduled = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });

    const conflicting = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T09:30:00-03:00', endsAt: '2026-11-03T10:30:00-03:00' });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.error.code).toBe('CONFLICTING_APPOINTMENTS');

    await scheduled.update({ status: 'CANCELED' });

    const afterCancel = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T09:30:00-03:00', endsAt: '2026-11-03T10:30:00-03:00' });
    expect(afterCancel.status).toBe(201);

    const adjacent = await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T10:30:00-03:00', endsAt: '2026-11-03T11:00:00-03:00' });
    expect(adjacent.status).toBe(201);
  });

  test('depois de criar o bloqueio, o horário some da disponibilidade', async () => {
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    await api
      .post('/api/time-off')
      .set('Authorization', auth(barberToken))
      .send({ startsAt: '2026-11-03T10:00:00-03:00', endsAt: '2026-11-03T11:00:00-03:00' });

    const availability = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(availability.body.slots).not.toContain('2026-11-03T10:00:00-03:00');
  });
});
