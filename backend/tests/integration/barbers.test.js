const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser } = require('../helpers/factories');

beforeEach(resetDb);
afterAll(closeDb);

describe('GET /api/barbers', () => {
  test('lista apenas barbeiros ativos, ordenados por nome, sem e-mail', async () => {
    await createUser({ role: 'BARBER', name: 'Zeca' });
    await createUser({ role: 'BARBER', name: 'Ana', active: false });
    await createUser({ role: 'BARBER', name: 'Bruno' });
    await createUser({ role: 'ADMIN', name: 'Admin' });
    await createUser({ role: 'CLIENT', name: 'Cliente' });

    const res = await api.get('/api/barbers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: 'Bruno' },
      { id: expect.any(Number), name: 'Zeca' },
    ]);
    res.body.forEach((b) => expect(b.email).toBeUndefined());
  });
});
