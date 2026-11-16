const { Op } = require('sequelize');
const { TimeOff } = require('../models');

const findOverlapping = ({ barberId, from, to, transaction }) => {
  const where = {
    startsAt: { [Op.lt]: to },
    endsAt: { [Op.gt]: from },
  };
  if (barberId) where.barberId = barberId;
  return TimeOff.findAll({ where, transaction });
};

const list = ({ barberId } = {}) =>
  TimeOff.findAll({ where: barberId ? { barberId } : {}, order: [['startsAt', 'ASC']] });

const findById = (id) => TimeOff.findByPk(id);
const create = (data) => TimeOff.create(data);
const destroy = (timeOff) => timeOff.destroy();

module.exports = { findOverlapping, list, findById, create, destroy };
