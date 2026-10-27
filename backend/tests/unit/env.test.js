const env = require('../../src/config/env');

describe('env (NODE_ENV=test)', () => {
  test('usa o banco de teste e custo de bcrypt baixo', () => {
    expect(env.nodeEnv).toBe('test');
    expect(env.db.name).toBe(process.env.DB_NAME_TEST || 'barber_time_test');
    expect(env.bcryptCost).toBe(4);
  });

  test('porta padrão 3333 e CORS como array', () => {
    expect(env.port).toBe(Number(process.env.PORT) || 3333);
    expect(Array.isArray(env.corsOrigins)).toBe(true);
    expect(env.corsOrigins).toEqual(
      (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
    );
  });
});
