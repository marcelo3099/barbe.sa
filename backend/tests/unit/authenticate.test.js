const { User } = require('../../src/models');
const { authenticate } = require('../../src/middlewares/authenticate');
const { signToken } = require('../../src/utils/jwt');
const { AppError } = require('../../src/errors/AppError');

afterEach(() => jest.restoreAllMocks());

const reqWith = (token) => ({ headers: { authorization: `Bearer ${token}` } });

describe('authenticate', () => {
  it('repassa erros inesperados (ex.: banco) em vez de responder 401', async () => {
    const dbError = new Error('connection refused');
    jest.spyOn(User, 'findByPk').mockRejectedValue(dbError);
    const next = jest.fn();
    await authenticate(reqWith(signToken({ id: 1, role: 'CLIENT' })), {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBe(dbError);
  });

  it('token inválido vira 401 UNAUTHORIZED', async () => {
    const next = jest.fn();
    await authenticate(reqWith('abc'), {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('sub não inteiro vira 401 sem consultar o banco', async () => {
    const spy = jest.spyOn(User, 'findByPk');
    const next = jest.fn();
    await authenticate(reqWith(signToken({ id: 'x', role: 'CLIENT' })), {}, next);
    expect(next.mock.calls[0][0].code).toBe('UNAUTHORIZED');
    expect(spy).not.toHaveBeenCalled();
  });
});
