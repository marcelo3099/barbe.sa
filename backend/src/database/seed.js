const { sequelize, User, BusinessHours, Service } = require('../models');
const { hashPassword } = require('../utils/password');

async function seedAdmin({ adminEmail, adminPassword }) {
  const existing = await User.findOne({ where: { email: adminEmail } });
  if (existing) return existing;

  const passwordHash = await hashPassword(adminPassword);
  return User.create({
    name: 'Administrador',
    email: adminEmail,
    passwordHash,
    role: 'ADMIN',
    active: true,
  });
}

async function seedBusinessHours() {
  const count = await BusinessHours.count();
  if (count > 0) return;

  const rows = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    if (weekday === 0) {
      rows.push({
        weekday,
        opensAt: '00:00',
        closesAt: '00:00',
        breakStartsAt: null,
        breakEndsAt: null,
        closed: true,
      });
    } else if (weekday === 6) {
      rows.push({
        weekday,
        opensAt: '09:00',
        closesAt: '14:00',
        breakStartsAt: null,
        breakEndsAt: null,
        closed: false,
      });
    } else {
      rows.push({
        weekday,
        opensAt: '09:00',
        closesAt: '19:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        closed: false,
      });
    }
  }
  await BusinessHours.bulkCreate(rows);
}

async function seedServicesAndBarber() {
  const count = await Service.count();
  if (count > 0) return;

  await Service.bulkCreate([
    {
      name: 'Corte clássico',
      description: 'Corte na tesoura e máquina',
      priceCents: 4500,
      durationMinutes: 30,
    },
    {
      name: 'Barba',
      description: 'Barba na navalha com toalha quente',
      priceCents: 3500,
      durationMinutes: 30,
    },
    {
      name: 'Corte e barba',
      description: 'Combo completo',
      priceCents: 7500,
      durationMinutes: 60,
    },
  ]);

  const passwordHash = await hashPassword('barbeiro123');
  await User.create({
    name: 'Seu Jorge',
    email: 'jorge@barbertime.local',
    passwordHash,
    role: 'BARBER',
    active: true,
  });
}

async function seed({ adminEmail, adminPassword }) {
  await seedAdmin({ adminEmail, adminPassword });
  await seedBusinessHours();
  await seedServicesAndBarber();
}

if (require.main === module) {
  // eslint-disable-next-line global-require
  const env = require('../config/env');
  (async () => {
    if (!env.adminEmail || !env.adminPassword) {
      console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de rodar o seed.');
      process.exitCode = 1;
      return;
    }
    try {
      await seed({ adminEmail: env.adminEmail, adminPassword: env.adminPassword });
      console.log('Seed concluído.');
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = { seed };
