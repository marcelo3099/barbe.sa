const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):(00|15|30|45)$/;

const rowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string(),
  closesAt: z.string(),
  breakStartsAt: z.string().nullable().optional(),
  breakEndsAt: z.string().nullable().optional(),
  closed: z.boolean(),
});

const businessHoursSchema = z
  .array(rowSchema)
  .length(7, 'Envie exatamente 7 linhas, uma por dia da semana')
  .superRefine((rows, ctx) => {
    const weekdays = rows.map((r) => r.weekday);
    const distinct = new Set(weekdays);
    const coversAllDays = Array.from({ length: 7 }, (_, i) => i).every((d) => distinct.has(d));
    if (distinct.size !== 7 || !coversAllDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cada dia da semana (0 a 6) deve aparecer exatamente uma vez',
        path: ['weekday'],
      });
      return;
    }

    rows.forEach((row, index) => {
      if (row.closed) return;

      const opensValid = timeRegex.test(row.opensAt);
      const closesValid = timeRegex.test(row.closesAt);
      if (!opensValid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Horário inválido', path: [index, 'opensAt'] });
      }
      if (!closesValid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Horário inválido', path: [index, 'closesAt'] });
      }
      if (opensValid && closesValid && !(row.opensAt < row.closesAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Abertura precisa ser antes do fechamento',
          path: [index, 'opensAt'],
        });
      }

      const hasBreakStart = row.breakStartsAt != null;
      const hasBreakEnd = row.breakEndsAt != null;
      if (hasBreakStart !== hasBreakEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe início e fim do intervalo, ou nenhum dos dois',
          path: [index, 'breakStartsAt'],
        });
      } else if (hasBreakStart && hasBreakEnd) {
        const breakStartValid = timeRegex.test(row.breakStartsAt);
        const breakEndValid = timeRegex.test(row.breakEndsAt);
        if (!breakStartValid || !breakEndValid) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Horário inválido', path: [index, 'breakStartsAt'] });
        } else if (
          opensValid &&
          closesValid &&
          !(row.opensAt <= row.breakStartsAt && row.breakStartsAt < row.breakEndsAt && row.breakEndsAt <= row.closesAt)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'O intervalo precisa estar dentro do expediente',
            path: [index, 'breakStartsAt'],
          });
        }
      }
    });
  });

module.exports = { businessHoursSchema };
