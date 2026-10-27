const { api } = require('../helpers/api');

describe('erros padronizados, 404 e CORS', () => {
  it('rota inexistente -> 404 NOT_FOUND', async () => {
    const res = await api.get('/api/rota-que-nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('JSON malformado -> 400 VALIDATION_ERROR', async () => {
    const res = await api
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('origem permitida recebe header CORS', async () => {
    const res = await api.get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('origem fora da lista -> 403 CORS_NOT_ALLOWED', async () => {
    const res = await api.get('/api/health').set('Origin', 'http://evil.com');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_NOT_ALLOWED');
  });
});
