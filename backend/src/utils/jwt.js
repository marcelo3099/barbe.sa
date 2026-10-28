const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALGORITHM = 'HS256';

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: env.jwtExpiresIn,
  });

const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });

module.exports = { signToken, verifyToken };
