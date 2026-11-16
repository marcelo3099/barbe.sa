const { User } = require('../models');

const findById = (id) => User.findByPk(id);
const findByEmail = (email) => User.findOne({ where: { email } });
const create = (data) => User.create(data);
const update = (user, data) => user.update(data);
const list = ({ role } = {}) =>
  User.findAll({ where: role ? { role } : {}, order: [['name', 'ASC']] });

const lockByIds = (ids, transaction) =>
  User.findAll({
    where: { id: ids },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

module.exports = { findById, findByEmail, create, update, list, lockByIds };
