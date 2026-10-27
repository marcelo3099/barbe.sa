const { z } = require('zod');
const { validate } = require('../../src/middlewares/validate');
const { AppError } = require('../../src/errors/AppError');

describe('validate', () => {
  const schema = z.object({ email: z.string().email('E-mail inválido') });

  it('chama next com AppError VALIDATION_ERROR e details por campo', () => {
    const req = { body: { email: 'x' } };
    const next = jest.fn();
    validate({ body: schema })(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ email: ['E-mail inválido'] });
  });

  it('com corpo válido chama next() sem argumento e substitui req.body parseado', () => {
    const req = { body: { email: 'a@b.com', extra: 1 } };
    const next = jest.fn();
    validate({ body: schema })(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com' });
  });

  it('grava query validada em req.validatedQuery', () => {
    const req = { query: { n: '5' } };
    const next = jest.fn();
    validate({ query: z.object({ n: z.coerce.number() }) })(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.validatedQuery).toEqual({ n: 5 });
  });

  it('usa _root para erro na raiz', () => {
    const req = { body: 'x' };
    const next = jest.fn();
    validate({ body: schema })(req, {}, next);
    expect(next.mock.calls[0][0].details._root).toBeDefined();
  });
});
