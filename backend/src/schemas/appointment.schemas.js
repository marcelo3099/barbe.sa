const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Id inválido'),
});

const createAppointmentSchema = z.object({
  serviceId: z.number().int().positive('Informe o serviço'),
  barberId: z.number().int().positive('Informe o barbeiro'),
  clientId: z.number().int().positive('Informe o cliente').optional(),
  startsAt: z
    .string()
    .datetime({ offset: true, message: 'Informe a data e hora com o fuso (offset)' })
    .transform((v) => new Date(v)),
});

const listAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional(),
  status: z
    .enum(['SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'], {
      errorMap: () => ({ message: 'Status inválido' }),
    })
    .optional(),
  barberId: z.coerce.number().int().positive('Id inválido').optional(),
});

const cancelAppointmentSchema = z.object({
  reason: z.string().max(255, 'Motivo muito longo').optional(),
});

const completeAppointmentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'PIX', 'CARD'], {
    errorMap: () => ({ message: 'Informe a forma de pagamento' }),
  }),
});

module.exports = {
  idParamSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  cancelAppointmentSchema,
  completeAppointmentSchema,
};
