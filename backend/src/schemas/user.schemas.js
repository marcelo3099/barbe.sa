const { z } = require('zod');
const { registerSchema } = require('./auth.schemas');

const roleEnum = z.enum(['ADMIN', 'BARBER', 'CLIENT'], {
  errorMap: () => ({ message: 'Perfil inválido' }),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Id inválido'),
});

const listUsersQuerySchema = z.object({
  role: roleEnum.optional(),
});

const createUserSchema = registerSchema.extend({
  role: roleEnum,
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo').optional(),
    phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido').nullable().optional(),
    role: roleEnum.optional(),
    active: z.boolean().optional(),
    password: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres')
      .max(72, 'A senha deve ter no máximo 72 caracteres')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo' });

module.exports = { idParamSchema, listUsersQuerySchema, createUserSchema, updateUserSchema };
