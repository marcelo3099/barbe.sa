const cors = require('cors');
const env = require('../config/env');
const { AppError } = require('../errors/AppError');

module.exports = cors({
  origin(origin, cb) {
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
    return cb(AppError.of('CORS_NOT_ALLOWED'));
  },
});
