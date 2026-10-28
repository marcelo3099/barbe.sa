const bcrypt = require('bcrypt');
const env = require('../config/env');

const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptCost);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, comparePassword };
