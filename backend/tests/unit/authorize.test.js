const { authorize } = require('../../src/middlewares/authorize');
const { AppError } = require('../../src/errors/AppError');

describe('authorize', () => {
  it('chama next com 403 FORBIDDEN quando o papel não está na lista', () => {
    const next = jest.fn();
    authorize('ADMIN')({ user: { id: 1, role: 'CLIENT' } }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('chama next() quando o papel está na lista', () => {
    const next = jest.fn();
    authorize('ADMIN', 'BARBER')({ user: { id: 1, role: 'ADMIN' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
