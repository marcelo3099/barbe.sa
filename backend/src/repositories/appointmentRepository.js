const { Op } = require('sequelize');
const { Appointment, User, Service } = require('../models');

const include = [
  { model: User, as: 'client', attributes: ['id', 'name', 'phone'] },
  { model: User, as: 'barber', attributes: ['id', 'name'] },
  { model: Service, as: 'service', attributes: ['id', 'name', 'durationMinutes'] },
];

const findFutureScheduled = ({ barberId, clientId, from, transaction }) => {
  const where = { status: 'SCHEDULED', startsAt: { [Op.gte]: from } };
  if (barberId) where.barberId = barberId;
  if (clientId) where.clientId = clientId;
  return Appointment.findAll({ where, include, order: [['startsAt', 'ASC']], transaction });
};

const findBusyForBarber = ({ barberId, from, to, transaction }) =>
  Appointment.findAll({
    where: {
      barberId,
      status: { [Op.ne]: 'CANCELED' },
      startsAt: { [Op.lt]: to },
      endsAt: { [Op.gt]: from },
    },
    include,
    transaction,
  });

const create = (data, transaction) => Appointment.create(data, { transaction });

const findByIdWithRelations = (id, transaction) =>
  Appointment.findByPk(id, { include, transaction });

const findClientOverlap = ({ clientId, startsAt, endsAt, transaction }) =>
  Appointment.findOne({
    where: {
      clientId,
      status: 'SCHEDULED',
      startsAt: { [Op.lt]: endsAt },
      endsAt: { [Op.gt]: startsAt },
    },
    transaction,
  });

const list = ({ clientId, barberId, status, from, to }) => {
  const where = {};
  if (clientId) where.clientId = clientId;
  if (barberId) where.barberId = barberId;
  if (status) where.status = status;
  if (from || to) {
    where.startsAt = {};
    if (from) where.startsAt[Op.gte] = from;
    if (to) where.startsAt[Op.lt] = to;
  }
  return Appointment.findAll({ where, include, order: [['startsAt', 'ASC']] });
};

module.exports = {
  include,
  findFutureScheduled,
  findBusyForBarber,
  create,
  findByIdWithRelations,
  findClientOverlap,
  list,
};
