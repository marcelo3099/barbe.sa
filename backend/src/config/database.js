const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const base = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME || 'barber_time' },
  test: { ...base, database: process.env.DB_NAME_TEST || 'barber_time_test' },
};
