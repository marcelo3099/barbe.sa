const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');
const { Appointment } = require('../../src/models');

beforeEach(resetDb);
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

describe('GET /api/users', () => {
  test('sem token -> 401', async () => {
    const res = await api.get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('CLIENT e BARBER -> 403', async () => {
    const { token: clientToken } = await createUser({ role: 'CLIENT' });
    const { token: barberToken } = await createUser({ role: 'BARBER' });

    const resClient = await api.get('/api/users').set('Authorization', auth(clientToken));
    const resBarber = await api.get('/api/users').set('Authorization', auth(barberToken));

    expect(resClient.status).toBe(403);
    expect(resBarber.status).toBe(403);
  });

  test('ADMIN lista todos, sem passwordHash, e filtra por role', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    await createUser({ role: 'BARBER', name: 'Seu Jorge' });
    await createUser({ role: 'CLIENT', name: 'Ana' });

    const res = await api.get('/api/users').set('Authorization', auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    res.body.forEach((u) => expect(u.passwordHash).toBeUndefined());

    const onlyBarbers = await api
      .get('/api/users?role=BARBER')
      .set('Authorization', auth(adminToken));
    expect(onlyBarbers.status).toBe(200);
    expect(onlyBarbers.body).toHaveLength(1);
    expect(onlyBarbers.body[0].role).toBe('BARBER');

    const invalid = await api.get('/api/users?role=XYZ').set('Authorization', auth(adminToken));
    expect(invalid.status).toBe(400);
  });
});

describe('POST /api/users', () => {
  test('ADMIN cria barbeiro', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });

    const res = await api
      .post('/api/users')
      .set('Authorization', auth(adminToken))
      .send({ name: 'Seu Jorge', email: 'jorge@example.com', password: 'senha1234', role: 'BARBER' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('BARBER');
    expect(res.body.passwordHash).toBeUndefined();
  });

  test('e-mail repetido -> 409 EMAIL_IN_USE', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    await createUser({ email: 'dup@example.com' });

    const res = await api
      .post('/api/users')
      .set('Authorization', auth(adminToken))
      .send({ name: 'Outro', email: 'dup@example.com', password: 'senha1234', role: 'CLIENT' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });
});

describe('PATCH /api/users/:id', () => {
  test('ADMIN altera nome, telefone e perfil de outro usuário', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { user: target } = await createUser({ role: 'CLIENT' });

    const res = await api
      .patch(`/api/users/${target.id}`)
      .set('Authorization', auth(adminToken))
      .send({ name: 'Novo Nome', phone: '11988887777', role: 'BARBER' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Novo Nome');
    expect(res.body.phone).toBe('11988887777');
    expect(res.body.role).toBe('BARBER');
  });

  test('alterar a senha permite login com a nova senha', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { user: target } = await createUser({ role: 'CLIENT', email: 'troca@example.com' });

    const patchRes = await api
      .patch(`/api/users/${target.id}`)
      .set('Authorization', auth(adminToken))
      .send({ password: 'novasenha123' });
    expect(patchRes.status).toBe(200);

    const loginRes = await api
      .post('/api/auth/login')
      .send({ email: 'troca@example.com', password: 'novasenha123' });
    expect(loginRes.status).toBe(200);
  });

  test('ADMIN não pode desativar nem rebaixar a si mesmo, mas pode mudar o nome', async () => {
    const { user: admin, token: adminToken } = await createUser({ role: 'ADMIN' });

    const deactivate = await api
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', auth(adminToken))
      .send({ active: false });
    expect(deactivate.status).toBe(422);
    expect(deactivate.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const demote = await api
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', auth(adminToken))
      .send({ role: 'CLIENT' });
    expect(demote.status).toBe(422);
    expect(demote.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const renameSelf = await api
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', auth(adminToken))
      .send({ name: 'Admin Renomeado' });
    expect(renameSelf.status).toBe(200);
  });

  test('id inexistente -> 404, id inválido -> 400', async () => {
    const { token: adminToken } = await createUser({ role: 'ADMIN' });

    const notFound = await api
      .patch('/api/users/9999')
      .set('Authorization', auth(adminToken))
      .send({ name: 'Qualquer' });
    expect(notFound.status).toBe(404);

    const invalid = await api
      .patch('/api/users/abc')
      .set('Authorization', auth(adminToken))
      .send({ name: 'Qualquer' });
    expect(invalid.status).toBe(400);
  });

  test('desativar ou rebaixar barbeiro com SCHEDULED futuro -> 409 CONFLICTING_APPOINTMENTS', async () => {
    freezeNow(NOW);
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: client } = await createUser({ role: 'CLIENT' });
    const service = await createService();

    const appointment = await Appointment.create({
      clientId: client.id,
      barberId: barber.id,
      serviceId: service.id,
      startsAt: new Date('2026-11-03T10:00:00-03:00'),
      endsAt: new Date('2026-11-03T10:30:00-03:00'),
      priceCents: service.priceCents,
      status: 'SCHEDULED',
    });

    const deactivate = await api
      .patch(`/api/users/${barber.id}`)
      .set('Authorization', auth(adminToken))
      .send({ active: false });
    expect(deactivate.status).toBe(409);
    expect(deactivate.body.error.code).toBe('CONFLICTING_APPOINTMENTS');
    expect(deactivate.body.error.details).toHaveLength(1);
    expect(deactivate.body.error.details[0].id).toBe(appointment.id);
    expect(deactivate.body.error.details[0].startsAt).toBe('2026-11-03T10:00:00-03:00');

    const demote = await api
      .patch(`/api/users/${barber.id}`)
      .set('Authorization', auth(adminToken))
      .send({ role: 'CLIENT' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('CONFLICTING_APPOINTMENTS');

    await appointment.update({ status: 'CANCELED' });

    const deactivateAfterCancel = await api
      .patch(`/api/users/${barber.id}`)
      .set('Authorization', auth(adminToken))
      .send({ active: false });
    expect(deactivateAfterCancel.status).toBe(200);
    expect(deactivateAfterCancel.body.active).toBe(false);
  });
});
