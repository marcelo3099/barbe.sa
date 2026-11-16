const { AppError } = require('../errors/AppError');
const serviceRepository = require('../repositories/serviceRepository');

const list = ({ includeInactive } = {}) => serviceRepository.list({ includeInactive });

const create = (data) => serviceRepository.create(data);

async function update(id, data) {
  const service = await serviceRepository.findById(id);
  if (!service) throw AppError.of('NOT_FOUND', undefined, 'Serviço não encontrado');
  return serviceRepository.update(service, data);
}

const deactivate = (id) => update(id, { active: false });

module.exports = { list, create, update, deactivate };
