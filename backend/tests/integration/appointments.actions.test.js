const { api } = require('../helpers/api');
const { resetDb, closeDb } = require('../helpers/db');
const { createUser, createService, createAppointment } = require('../helpers/factories');
const { freezeNow, NOW } = require('../helpers/clock');

beforeEach(async () => {
  await resetDb();
  freezeNow(NOW);
});
afterAll(closeDb);

const auth = (token) => `Bearer ${token}`;

describe('PATCH /api/appointments/:id/cancel', () => {
  test('sem token -> 401; cliente cancelando o de outro -> 403', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { token: otherClientToken } = await createUser({ role: 'CLIENT' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    const appointment = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });

    expect((await api.patch(`/api/appointments/${appointment.id}/cancel`).send({})).status).toBe(401);
    expect(
      (
        await api
          .patch(`/api/appointments/${appointment.id}/cancel`)
          .set('Authorization', auth(otherClientToken))
          .send({})
      ).status,
    ).toBe(403);
  });

  test('cliente cancela o próprio com mais de 2h de antecedência; com menos de 2h -> 422', async () => {
    const { user: client, token: clientToken } = await createUser({ role: 'CLIENT' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });

    const farEnough = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T11:00:00-03:00',
    });
    const res = await api
      .patch(`/api/appointments/${farEnough.id}/cancel`)
      .set('Authorization', auth(clientToken))
      .send({ reason: 'Imprevisto' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELED');
    expect(res.body.canceledAt).not.toBeNull();
    expect(res.body.cancelReason).toBe('Imprevisto');

    const tooClose = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T09:59:00-03:00',
    });
    const blocked = await api
      .patch(`/api/appointments/${tooClose.id}/cancel`)
      .set('Authorization', auth(clientToken))
      .send({});
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('CANCELLATION_WINDOW_CLOSED');
  });

  test('barbeiro cancela da própria agenda mesmo perto do início; de outra agenda -> 403; admin cancela qualquer', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const { user: otherBarber } = await createUser({ role: 'BARBER' });
    const { token: adminToken } = await createUser({ role: 'ADMIN' });
    const service = await createService({ durationMinutes: 30 });

    const own = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T08:10:00-03:00',
    });
    const ownRes = await api
      .patch(`/api/appointments/${own.id}/cancel`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(ownRes.status).toBe(200);

    const other = await createAppointment({
      client,
      barber: otherBarber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });
    const otherRes = await api
      .patch(`/api/appointments/${other.id}/cancel`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(otherRes.status).toBe(403);

    const adminRes = await api
      .patch(`/api/appointments/${other.id}/cancel`)
      .set('Authorization', auth(adminToken))
      .send({});
    expect(adminRes.status).toBe(200);
  });

  test('cancelar de novo -> 422 INVALID_STATUS_TRANSITION; horário volta na disponibilidade', async () => {
    const { user: client, token: clientToken } = await createUser({ role: 'CLIENT' });
    const { user: barber } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    const appointment = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T11:00:00-03:00',
    });

    const first = await api
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', auth(clientToken))
      .send({});
    expect(first.status).toBe(200);

    const second = await api
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', auth(clientToken))
      .send({});
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('PATCH /api/appointments/:id/complete', () => {
  test('CLIENT -> 403; barbeiro de outra agenda -> 403; antes do início -> 422; depois com paymentMethod -> 200', async () => {
    const { user: client, token: clientToken } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const { token: otherBarberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30, priceCents: 4500 });

    const before = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });

    expect(
      (
        await api
          .patch(`/api/appointments/${before.id}/complete`)
          .set('Authorization', auth(clientToken))
          .send({ paymentMethod: 'CASH' })
      ).status,
    ).toBe(403);

    expect(
      (
        await api
          .patch(`/api/appointments/${before.id}/complete`)
          .set('Authorization', auth(otherBarberToken))
          .send({ paymentMethod: 'CASH' })
      ).status,
    ).toBe(403);

    const tooEarly = await api
      .patch(`/api/appointments/${before.id}/complete`)
      .set('Authorization', auth(barberToken))
      .send({ paymentMethod: 'CASH' });
    expect(tooEarly.status).toBe(422);
    expect(tooEarly.body.error.code).toBe('APPOINTMENT_NOT_STARTED');

    const started = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T07:00:00-03:00',
    });
    const res = await api
      .patch(`/api/appointments/${started.id}/complete`)
      .set('Authorization', auth(barberToken))
      .send({ paymentMethod: 'PIX' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.paymentMethod).toBe('PIX');
    expect(res.body.paidAt).not.toBeNull();
    expect(res.body.priceCents).toBe(4500);

    const missingMethod = await api
      .patch(`/api/appointments/${started.id}/complete`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(missingMethod.status).toBe(400);
  });

  test('completar um CANCELED -> 422; id inexistente -> 404', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });
    const appointment = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T07:00:00-03:00',
      status: 'CANCELED',
    });

    const res = await api
      .patch(`/api/appointments/${appointment.id}/complete`)
      .set('Authorization', auth(barberToken))
      .send({ paymentMethod: 'CASH' });
    expect(res.status).toBe(422);

    const notFound = await api
      .patch('/api/appointments/9999/complete')
      .set('Authorization', auth(barberToken))
      .send({ paymentMethod: 'CASH' });
    expect(notFound.status).toBe(404);
  });
});

describe('PATCH /api/appointments/:id/no-show', () => {
  test('antes do início -> 422; depois -> 200 NO_SHOW; em COMPLETED -> 422', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30 });

    const before = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-03T10:00:00-03:00',
    });
    const tooEarly = await api
      .patch(`/api/appointments/${before.id}/no-show`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(tooEarly.status).toBe(422);

    const started = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T07:00:00-03:00',
    });
    const res = await api
      .patch(`/api/appointments/${started.id}/no-show`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NO_SHOW');

    const completed = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T07:00:00-03:00',
      status: 'COMPLETED',
    });
    const onCompleted = await api
      .patch(`/api/appointments/${completed.id}/no-show`)
      .set('Authorization', auth(barberToken))
      .send({});
    expect(onCompleted.status).toBe(422);
  });
});

describe('Serviço desativado com agendamentos existentes', () => {
  test('desativar o serviço não altera o agendamento já feito; ele continua listável e concluível', async () => {
    const { user: client } = await createUser({ role: 'CLIENT' });
    const { user: barber, token: barberToken } = await createUser({ role: 'BARBER' });
    const service = await createService({ durationMinutes: 30, priceCents: 4500 });

    const appointment = await createAppointment({
      client,
      barber,
      service,
      startsAt: '2026-11-02T07:00:00-03:00',
    });

    await api
      .delete(`/api/services/${service.id}`)
      .set('Authorization', auth((await createUser({ role: 'ADMIN' })).token));

    const list = await api.get('/api/appointments').set('Authorization', auth(barberToken));
    expect(list.body.find((a) => a.id === appointment.id)).toBeDefined();

    const complete = await api
      .patch(`/api/appointments/${appointment.id}/complete`)
      .set('Authorization', auth(barberToken))
      .send({ paymentMethod: 'CASH' });
    expect(complete.status).toBe(200);
    expect(complete.body.service.id).toBe(service.id);
  });
});
