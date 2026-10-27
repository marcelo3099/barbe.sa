const env = require('../config/env');
const { AppError } = require('../errors/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appError = err;

  if (!(err instanceof AppError)) {
    if (err && err.type === 'entity.parse.failed') {
      appError = AppError.of('VALIDATION_ERROR', undefined, 'JSON inválido');
    } else {
      if (env.nodeEnv !== 'test') console.error(err);
      appError = AppError.of('INTERNAL_ERROR');
    }
  }

  const body = { code: appError.code, message: appError.message };
  if (appError.details !== undefined) body.details = appError.details;
  return res.status(appError.status).json({ error: body });
}

module.exports = { errorHandler };
