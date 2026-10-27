const { sequelize } = require('../../src/models');

const resetDb = () => sequelize.sync({ force: true });
const closeDb = () => sequelize.close();

module.exports = { resetDb, closeDb };
