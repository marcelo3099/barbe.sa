const { z } = require('zod');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Data inválida');

const availabilityQuerySchema = z.object({
  barberId: z.coerce.number().int().positive('Informe o barbeiro'),
  serviceId: z.coerce.number().int().positive('Informe o serviço'),
  date: dateSchema,
});

module.exports = { availabilityQuerySchema };
