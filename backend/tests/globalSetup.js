const path = require('path');
const { Client } = require('pg');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

  const testDb = process.env.DB_NAME_TEST || 'barber_time_test';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${testDb}"`);
    }
  } finally {
    await client.end();
  }
};
