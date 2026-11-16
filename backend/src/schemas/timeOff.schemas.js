const { z } = require('zod');
const { DateTime } = require('luxon');
const { TZ } = require('../utils/time');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Id inválido'),
});

const isoOffsetDateTime = z
  .string()
  .datetime({ offset: true, message: 'Informe a data e hora com o fuso (offset)' })
  .transform((v) => new Date(v));

const onGrid = (date) => DateTime.fromJSDate(date, { zone: TZ }).minute % 15 === 0;

const createTimeOffSchema = z
  .object({
    barberId: z.number().int().positive('Informe o barbeiro').optional(),
    startsAt: isoOffsetDateTime,
    endsAt: isoOffsetDateTime,
    reason: z.string().max(255, 'Motivo muito longo').optional(),
  })
  .superRefine((data, ctx) => {
    if (!(data.endsAt > data.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O fim precisa ser depois do início',
        path: ['endsAt'],
      });
    }
    if (!onGrid(data.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Horário precisa estar na grade de 15 minutos',
        path: ['startsAt'],
      });
    }
    if (!onGrid(data.endsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Horário precisa estar na grade de 15 minutos',
        path: ['endsAt'],
      });
    }
  });

const listTimeOffQuerySchema = z.object({
  barberId: z.coerce.number().int().positive('Id inválido').optional(),
});

module.exports = { idParamSchema, createTimeOffSchema, listTimeOffQuerySchema };
