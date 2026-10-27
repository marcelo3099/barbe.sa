const { api } = require('../helpers/api');
const { sequelize } = require('../../src/models');

afterAll(() => sequelize.close());

test('GET /api/health responde 200 { status: "ok" }', async () => {
  const res = await api.get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('conecta no banco de teste', async () => {
  await expect(sequelize.authenticate()).resolves.toBeUndefined();
  expect(sequelize.getDatabase()).toBe('barber_time_test');
});
