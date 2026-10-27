const { AppError } = require('../errors/AppError');

function notFound(req, res, next) {
  next(AppError.of('NOT_FOUND', undefined, 'Rota não encontrada'));
}

module.exports = { notFound };
