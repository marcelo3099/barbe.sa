const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('E-mail inválido');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  email,
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(72, 'A senha deve ter no máximo 72 caracteres'),
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido').optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
});

module.exports = { registerSchema, loginSchema };
