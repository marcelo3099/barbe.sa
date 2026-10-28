const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt', () => {
  it('sign -> verify devolve sub e role', () => {
    const token = signToken({ id: 7, role: 'BARBER' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe(7);
    expect(payload.role).toBe('BARBER');
  });

  it('verify lança para token inválido', () => {
    expect(() => verifyToken('abc')).toThrow();
  });

  it('rejeita token assinado com HS512 usando o mesmo segredo', () => {
    const token = jwt.sign({ sub: 1, role: 'ADMIN' }, env.jwtSecret, { algorithm: 'HS512' });
    expect(() => verifyToken(token)).toThrow();
  });
});
