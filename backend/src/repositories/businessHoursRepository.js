const { BusinessHours } = require('../models');

const findAll = ({ transaction } = {}) =>
  BusinessHours.findAll({ order: [['weekday', 'ASC']], transaction });

const findByWeekday = (weekday) => BusinessHours.findOne({ where: { weekday } });

const replaceAll = async (rows, transaction) => {
  await BusinessHours.destroy({ where: {}, transaction });
  await BusinessHours.bulkCreate(rows, { transaction });
};

module.exports = { findAll, findByWeekday, replaceAll };
