const { api } = require('../helpers/api');
const { sequelize } = require('../../src/models');

afterAll(() => sequelize.close());

test('GET /docs/ responde 200 em HTML', async () => {
  const res = await api.get('/docs/');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
});

test('GET /docs.json responde o documento OpenAPI com os paths principais', async () => {
  const res = await api.get('/docs.json');
  expect(res.status).toBe(200);
  expect(res.body.openapi.startsWith('3.')).toBe(true);
  expect(res.body.paths).toHaveProperty('/appointments/{id}/cancel');
  expect(res.body.paths).toHaveProperty('/availability');
  expect(res.body.paths).toHaveProperty('/auth/login');
});
