const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Id inválido'),
});

const listServicesQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const durationSchema = z
  .number()
  .int('Duração deve ser um número inteiro de minutos')
  .min(15, 'Duração mínima de 15 minutos')
  .max(240, 'Duração máxima de 240 minutos')
  .refine((n) => n % 15 === 0, 'Duração deve ser múltipla de 15 minutos');

const priceSchema = z
  .number()
  .int('Preço deve ser um valor inteiro em centavos')
  .min(0, 'Preço não pode ser negativo');

const createServiceSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional().default(''),
  priceCents: priceSchema,
  durationMinutes: durationSchema,
});

const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo').optional(),
    description: z.string().max(500, 'Descrição muito longa').optional(),
    priceCents: priceSchema.optional(),
    durationMinutes: durationSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo' });

module.exports = {
  idParamSchema,
  listServicesQuerySchema,
  createServiceSchema,
  updateServiceSchema,
};
