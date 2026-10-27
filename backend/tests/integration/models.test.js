const { resetDb, closeDb } = require('../helpers/db');
const {
  createUser,
  createService,
  setDefaultHours,
  createAppointment,
  createTimeOff,
} = require('../helpers/factories');
const { Appointment, BusinessHours } = require('../../src/models');

beforeEach(resetDb);
afterAll(closeDb);

describe('models', () => {
  it('persists and associates the core entities', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({});
    await setDefaultHours();
    const appointment = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });
    await createTimeOff({
      barber,
      startsAt: '2026-11-04T12:00:00-03:00',
      endsAt: '2026-11-04T13:00:00-03:00',
      reason: 'Almoço',
    });

    const found = await Appointment.findByPk(appointment.id, {
      include: ['client', 'barber', 'service'],
    });

    expect(found.client.id).toBe(client.id);
    expect(found.barber.id).toBe(barber.id);
    expect(found.service.id).toBe(service.id);
    expect(found.status).toBe('SCHEDULED');
    expect(found.priceCents).toBe(4500);
    expect(found.endsAt.getTime() - found.startsAt.getTime()).toBe(30 * 60 * 1000);
    expect(await BusinessHours.count()).toBe(7);
  });

  it('rejects two users with the same email', async () => {
    await createUser({ email: 'dup@example.com' });
    await expect(createUser({ email: 'dup@example.com' })).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    });
  });
});
