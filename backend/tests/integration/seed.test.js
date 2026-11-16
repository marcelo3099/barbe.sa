const { seed } = require('../../src/database/seed');
const { resetDb, closeDb } = require('../helpers/db');
const { User, BusinessHours, Service } = require('../../src/models');
const { api } = require('../helpers/api');

beforeEach(resetDb);
afterAll(closeDb);

test('seed é idempotente e cria admin, horários e serviços/barbeiro demo', async () => {
  await seed({ adminEmail: 'root@x.com', adminPassword: 'senha1234' });
  await seed({ adminEmail: 'root@x.com', adminPassword: 'senha1234' });

  const admins = await User.count({ where: { role: 'ADMIN' } });
  expect(admins).toBe(1);

  const hours = await BusinessHours.count();
  expect(hours).toBe(7);

  const services = await Service.count();
  expect(services).toBe(3);

  const barbers = await User.count({ where: { role: 'BARBER' } });
  expect(barbers).toBe(1);

  const login = await api.post('/api/auth/login').send({ email: 'root@x.com', password: 'senha1234' });
  expect(login.status).toBe(200);
  expect(login.body.user.role).toBe('ADMIN');
});
