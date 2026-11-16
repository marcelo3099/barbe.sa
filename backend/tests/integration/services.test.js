const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService } = require('../helpers/factories');

beforeEach(resetDb);
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

describe('GET /api/services', () => {
  test('sem token -> só ativos, ordenados por nome', async () => {
    await createService({ name: 'Zebra', active: true });
    await createService({ name: 'Alpha', active: true });
    await createService({ name: 'Inativo', active: false });

    const res = await api.get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.name)).toEqual(['Alpha', 'Zebra']);
  });

  test('ADMIN com includeInactive=true vê inativos; CLIENT não', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { token: clientToken } = await createUser({ role: 'CLIENT' });
    await createService({ name: 'Ativo', active: true });
    await createService({ name: 'Inativo', active: false });

    const asAdmin = await api
      .get('/api/services?includeInactive=true')
      .set('Authorization', auth(adminToken));
    expect(asAdmin.body).toHaveLength(2);

    const asClient = await api
      .get('/api/services?includeInactive=true')
      .set('Authorization', auth(clientToken));
    expect(asClient.body).toHaveLength(1);
  });
});

describe('POST /PATCH /DELETE /api/services', () => {
  test('sem token -> 401; CLIENT e BARBER -> 403', async () => {
    const { token: clientToken } = await createUser({ role: 'CLIENT' });
    const { token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService();

    const body = { name: 'Corte', priceCents: 1000, durationMinutes: 30 };

    expect((await api.post('/api/services').send(body)).status).toBe(401);
    expect(
      (await api.post('/api/services').set('Authorization', auth(clientToken)).send(body)).status,
    ).toBe(403);
    expect(
      (await api.post('/api/services').set('Authorization', auth(barberToken)).send(body)).status,
    ).toBe(403);

    expect((await api.patch(`/api/services/${service.id}`).send({ name: 'X' })).status).toBe(401);
    expect((await api.delete(`/api/services/${service.id}`)).status).toBe(401);
  });

  test('ADMIN cria serviço no formato da 7.1', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });

    const res = await api
      .post('/api/services')
      .set('Authorization', auth(adminToken))
      .send({ name: 'Corte clássico', description: 'Tesoura', priceCents: 4500, durationMinutes: 30 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Corte clássico',
      description: 'Tesoura',
      priceCents: 4500,
      durationMinutes: 30,
      active: true,
    });
  });

  test('valores de borda -> 400 VALIDATION_ERROR', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const base = { name: 'Corte', description: '' };

    const cases = [
      { ...base, priceCents: -1, durationMinutes: 30 },
      { ...base, priceCents: 10.5, durationMinutes: 30 },
      { ...base, priceCents: 1000, durationMinutes: 0 },
      { ...base, priceCents: 1000, durationMinutes: 250 },
      { ...base, priceCents: 1000, durationMinutes: 20 },
    ];

    for (const body of cases) {
      const res = await api.post('/api/services').set('Authorization', auth(adminToken)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('DELETE desativa, some da listagem padrão; id inexistente -> 404', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const service = await createService({ name: 'Barba', active: true });

    const res = await api.delete(`/api/services/${service.id}`).set('Authorization', auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);

    const list = await api.get('/api/services');
    expect(list.body.find((s) => s.id === service.id)).toBeUndefined();

    const notFound = await api
      .delete('/api/services/9999')
      .set('Authorization', auth(adminToken));
    expect(notFound.status).toBe(404);
  });
});
