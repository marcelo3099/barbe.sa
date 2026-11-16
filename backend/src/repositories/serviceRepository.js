const { Service } = require('../models');

const findById = (id) => Service.findByPk(id);

const list = ({ includeInactive } = {}) =>
  Service.findAll({
    where: includeInactive ? {} : { active: true },
    order: [['name', 'ASC']],
  });

const create = (data) => Service.create(data);
const update = (service, data) => service.update(data);

module.exports = { findById, list, create, update };
