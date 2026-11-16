const { z } = require('zod');

const createAppointmentSchema = z.object({
  serviceId: z.number().int().positive('Informe o serviço'),
  barberId: z.number().int().positive('Informe o barbeiro'),
  clientId: z.number().int().positive('Informe o cliente').optional(),
  startsAt: z
    .string()
    .datetime({ offset: true, message: 'Informe a data e hora com o fuso (offset)' })
    .transform((v) => new Date(v)),
});

module.exports = { createAppointmentSchema };
