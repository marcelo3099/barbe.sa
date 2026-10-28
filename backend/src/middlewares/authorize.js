const { AppError } = require('../errors/AppError');

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(AppError.of('FORBIDDEN'));
  return next();
};

module.exports = { authorize };
