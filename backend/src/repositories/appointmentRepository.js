const { Op } = require('sequelize');
const { Appointment, User, Service } = require('../models');

const include = [
  { model: User, as: 'client', attributes: ['id', 'name', 'phone'] },
  { model: User, as: 'barber', attributes: ['id', 'name'] },
  { model: Service, as: 'service', attributes: ['id', 'name', 'durationMinutes'] },
];

const findFutureScheduled = ({ barberId, clientId, from }) => {
  const where = { status: 'SCHEDULED', startsAt: { [Op.gte]: from } };
  if (barberId) where.barberId = barberId;
  if (clientId) where.clientId = clientId;
  return Appointment.findAll({ where, include, order: [['startsAt', 'ASC']] });
};

module.exports = { include, findFutureScheduled };
