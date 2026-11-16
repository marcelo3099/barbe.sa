const userRepository = require('../repositories/userRepository');
const { barberJson } = require('../serializers');

async function list(req, res) {
  const barbers = await userRepository.list({ role: 'BARBER' });
  res.json(barbers.filter((b) => b.active).map(barberJson));
}

module.exports = { list };
