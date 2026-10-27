const path = require('path');
const { execSync } = require('child_process');
const { sequelize, User, Service, BusinessHours, TimeOff, Appointment } = require('../../src/models');
const { resetDb, closeDb } = require('../helpers/db');

const backendDir = path.resolve(__dirname, '../..');

afterAll(async () => {
  await resetDb();
  await closeDb();
});

describe('migrations', () => {
  it('create tables matching the models', async () => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropAllTables();
    await queryInterface.dropAllEnums();

    execSync('npx sequelize-cli db:migrate --env test', {
      cwd: backendDir,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe',
    });

    for (const Model of [User, Service, BusinessHours, TimeOff, Appointment]) {
      const columns = Object.keys(await queryInterface.describeTable(Model.getTableName())).sort();
      const fields = Object.values(Model.getAttributes())
        .map((attribute) => attribute.field)
        .sort();
      expect(columns).toEqual(fields);
    }
  });
});
