const jwt = require('jsonwebtoken');
const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser } = require('../helpers/factories');
const { User } = require('../../src/models');
const { verifyToken } = require('../../src/utils/jwt');
const env = require('../../src/config/env');

beforeEach(resetDb);
afterAll(closeDb);

const valid = { name: 'Ana Souza', email: 'ana@x.com', password: 'senha1234', phone: '11999998888' };

describe('POST /api/auth/register', () => {
  it('cria CLIENT e devolve o usuário sem dados de senha', async () => {
    const res = await api.post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Ana Souza',
      email: 'ana@x.com',
      phone: '11999998888',
      role: 'CLIENT',
      active: true,
    });
    const row = await User.findByPk(res.body.id);
    expect(row.passwordHash.startsWith('$2')).toBe(true);
    expect(row.passwordHash).not.toBe(valid.password);
  });

  it('ignora role enviado no corpo', async () => {
    const res = await api.post('/api/auth/register').send({ ...valid, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('CLIENT');
  });

  it('normaliza e-mail e rejeita duplicado com 409 EMAIL_IN_USE', async () => {
    const first = await api.post('/api/auth/register').send({ ...valid, email: ' Ana@X.com ' });
    expect(first.status).toBe(201);
    expect(first.body.email).toBe('ana@x.com');
    const second = await api.post('/api/auth/register').send(valid);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_IN_USE');
  });

  it.each([
    ['7', 'a'.repeat(7)],
    ['73', 'a'.repeat(73)],
  ])('rejeita senha de %s caracteres', async (_label, password) => {
    const res = await api.post('/api/auth/register').send({ ...valid, password });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeDefined();
  });

  it('rejeita e-mail inválido', async () => {
    const res = await api.post('/api/auth/register').send({ ...valid, email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.email).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('login correto devolve token e user', async () => {
    const { user, password } = await createUser({ email: 'a@x.com' });
    const res = await api.post('/api/auth/login').send({ email: 'a@x.com', password });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(expect.objectContaining({ id: user.id, role: 'CLIENT' }));
    const payload = verifyToken(res.body.token);
    expect(payload.sub).toBe(user.id);
    expect(payload.role).toBe('CLIENT');
  });

  it('senha errada e e-mail inexistente dão a mesma resposta 401', async () => {
    await createUser({ email: 'a@x.com' });
    const wrong = await api.post('/api/auth/login').send({ email: 'a@x.com', password: 'errada123' });
    const unknown = await api.post('/api/auth/login').send({ email: 'z@x.com', password: 'errada123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('usuário inativo não entra', async () => {
    const { password } = await createUser({ email: 'a@x.com', active: false });
    const res = await api.post('/api/auth/login').send({ email: 'a@x.com', password });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  it('sem token -> 401 UNAUTHORIZED', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('token malformado -> 401', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', 'Bearer abc');
    expect(res.status).toBe(401);
  });

  it('token expirado -> 401', async () => {
    const { user } = await createUser();
    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: -10 });
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('token válido -> 200 com o usuário', async () => {
    const { user, token } = await createUser();
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: null,
      role: 'CLIENT',
      active: true,
    });
  });

  it('token válido de usuário desativado depois -> 401', async () => {
    const { user, token } = await createUser();
    await user.update({ active: false });
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
