const { Sequelize, DataTypes } = require('sequelize');
const env = require('../config/env');

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
});

const User = require('./User')(sequelize, DataTypes);
const Service = require('./Service')(sequelize, DataTypes);
const BusinessHours = require('./BusinessHours')(sequelize, DataTypes);
const TimeOff = require('./TimeOff')(sequelize, DataTypes);
const Appointment = require('./Appointment')(sequelize, DataTypes);

Appointment.belongsTo(User, { as: 'client', foreignKey: 'clientId', onDelete: 'RESTRICT' });
Appointment.belongsTo(User, { as: 'barber', foreignKey: 'barberId', onDelete: 'RESTRICT' });
Appointment.belongsTo(Service, { as: 'service', foreignKey: 'serviceId', onDelete: 'RESTRICT' });
TimeOff.belongsTo(User, { as: 'barber', foreignKey: 'barberId', onDelete: 'RESTRICT' });

module.exports = { sequelize, Sequelize, User, Service, BusinessHours, TimeOff, Appointment };
