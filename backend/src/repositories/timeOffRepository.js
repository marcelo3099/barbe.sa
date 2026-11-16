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

module.exports = { findOverlapping };
