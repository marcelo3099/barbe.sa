const { errorHandler } = require('../../src/middlewares/errorHandler');
const { AppError } = require('../../src/errors/AppError');

function fakeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('erro inesperado vira 500 INTERNAL_ERROR sem stack', () => {
    const res = fakeRes();
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    });
  });

  it('AppError mantém status, code, message e details', () => {
    const res = fakeRes();
    errorHandler(AppError.of('VALIDATION_ERROR', { a: ['x'] }), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: { a: ['x'] } },
    });
  });

  it('AppError sem details omite a chave', () => {
    const res = fakeRes();
    errorHandler(AppError.of('NOT_FOUND', undefined, 'Barbeiro não encontrado'), {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Barbeiro não encontrado' },
    });
  });

  it('JSON malformado vira 400 VALIDATION_ERROR', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('bad'), { type: 'entity.parse.failed' }), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe('VALIDATION_ERROR');
  });
});
