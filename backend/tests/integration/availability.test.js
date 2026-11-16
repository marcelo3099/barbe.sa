const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService, setDefaultHours } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');
const { Appointment, TimeOff } = require('../../src/models');

beforeEach(resetDb);
afterAll(closeDb);

describe('GET /api/availability', () => {
  test('30 slots num dia aberto, do 09:00 ao 17:30', async () => {
    freezeNow(NOW);
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    const res = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-11-03');
    expect(res.body.slots).toHaveLength(30);
    expect(res.body.slots[0]).toBe('2026-11-03T09:00:00-03:00');
    expect(res.body.slots[res.body.slots.length - 1]).toBe('2026-11-03T17:30:00-03:00');
  });

  test('agendamento SCHEDULED ocupa o horário; CANCELED libera; COMPLETED e NO_SHOW ocupam', async () => {
    freezeNow(NOW);
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: client } = await createUser({ role: 'CLIENT' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    const appointment = await Appointment.create({
      clientId: client.id,
      barberId: barber.id,
      serviceId: service.id,
      startsAt: new Date('2026-11-03T10:00:00-03:00'),
      endsAt: new Date('2026-11-03T10:30:00-03:00'),
      priceCents: service.priceCents,
      status: 'SCHEDULED',
    });

    const query = `barberId=${barber.id}&serviceId=${service.id}&date=2026-11-03`;
    const scheduled = await api.get(`/api/availability?${query}`);
    expect(scheduled.body.slots).not.toContain('2026-11-03T09:45:00-03:00');
    expect(scheduled.body.slots).not.toContain('2026-11-03T10:00:00-03:00');

    await appointment.update({ status: 'CANCELED' });
    const canceled = await api.get(`/api/availability?${query}`);
    expect(canceled.body.slots).toContain('2026-11-03T10:00:00-03:00');

    await appointment.update({ status: 'COMPLETED' });
    const completed = await api.get(`/api/availability?${query}`);
    expect(completed.body.slots).not.toContain('2026-11-03T10:00:00-03:00');

    await appointment.update({ status: 'NO_SHOW' });
    const noShow = await api.get(`/api/availability?${query}`);
    expect(noShow.body.slots).not.toContain('2026-11-03T10:00:00-03:00');
  });

  test('agendamento de outro barbeiro não afeta', async () => {
    freezeNow(NOW);
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: otherBarber } = await createUser({ role: 'BARBER' });
    const { user: client } = await createUser({ role: 'CLIENT' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    await Appointment.create({
      clientId: client.id,
      barberId: otherBarber.id,
      serviceId: service.id,
      startsAt: new Date('2026-11-03T10:00:00-03:00'),
      endsAt: new Date('2026-11-03T10:30:00-03:00'),
      priceCents: service.priceCents,
      status: 'SCHEDULED',
    });

    const res = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(res.body.slots).toContain('2026-11-03T10:00:00-03:00');
  });

  test('bloqueio (TimeOff) remove o período', async () => {
    freezeNow(NOW);
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    await setDefaultHours();

    await TimeOff.create({
      barberId: barber.id,
      startsAt: new Date('2026-11-03T10:00:00-03:00'),
      endsAt: new Date('2026-11-03T11:00:00-03:00'),
    });

    const res = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(res.body.slots).not.toContain('2026-11-03T10:00:00-03:00');
    expect(res.body.slots).not.toContain('2026-11-03T10:30:00-03:00');
  });

  test('domingo, serviço inativo e barbeiro inativo -> slots vazios', async () => {
    freezeNow(NOW);
    const { user: barber } = await createUser({ role: 'BARBER' });
    const { user: inactiveBarber } = await createUser({ role: 'BARBER', active: false });
    const service = await createService({ durationMinutes: 30 });
    const inactiveService = await createService({ durationMinutes: 30, active: false });
    await setDefaultHours();

    const sunday = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-11-08`,
    );
    expect(sunday.body.slots).toEqual([]);

    const withInactiveService = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${inactiveService.id}&date=2026-11-03`,
    );
    expect(withInactiveService.body.slots).toEqual([]);

    const withInactiveBarber = await api.get(
      `/api/availability?barberId=${inactiveBarber.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(withInactiveBarber.body.slots).toEqual([]);
  });

  test('barbeiro/serviço inexistente ou inválido -> 404/400', async () => {
    freezeNow(NOW);
    const { user: client } = await createUser({ role: 'CLIENT' });
    const service = await createService();
    await setDefaultHours();

    const clientAsBarber = await api.get(
      `/api/availability?barberId=${client.id}&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(clientAsBarber.status).toBe(404);

    const missingBarber = await api.get(
      `/api/availability?barberId=9999&serviceId=${service.id}&date=2026-11-03`,
    );
    expect(missingBarber.status).toBe(404);

    const { user: barber } = await createUser({ role: 'BARBER' });
    const missingService = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=9999&date=2026-11-03`,
    );
    expect(missingService.status).toBe(404);

    const badDate = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=2026-02-30`,
    );
    expect(badDate.status).toBe(400);

    const badFormat = await api.get(
      `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=03-11-2026`,
    );
    expect(badFormat.status).toBe(400);

    const missingBarberId = await api.get(
      `/api/availability?serviceId=${service.id}&date=2026-11-03`,
    );
    expect(missingBarberId.status).toBe(400);
  });
});
