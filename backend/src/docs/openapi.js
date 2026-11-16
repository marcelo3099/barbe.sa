const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' },
      },
      required: ['code', 'message'],
    },
  },
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['ADMIN', 'BARBER', 'CLIENT'] },
    active: { type: 'boolean' },
  },
};

const serviceSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    description: { type: 'string' },
    priceCents: { type: 'integer' },
    durationMinutes: { type: 'integer' },
    active: { type: 'boolean' },
  },
};

const barberSchema = {
  type: 'object',
  properties: { id: { type: 'integer' }, name: { type: 'string' } },
};

const businessHoursSchema = {
  type: 'object',
  properties: {
    weekday: { type: 'integer', minimum: 0, maximum: 6 },
    opensAt: { type: 'string' },
    closesAt: { type: 'string' },
    breakStartsAt: { type: 'string', nullable: true },
    breakEndsAt: { type: 'string', nullable: true },
    closed: { type: 'boolean' },
  },
};

const timeOffSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    barberId: { type: 'integer' },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    reason: { type: 'string', nullable: true },
  },
};

const appointmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    status: { type: 'string', enum: ['SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'] },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    priceCents: { type: 'integer' },
    paymentMethod: { type: 'string', enum: ['CASH', 'PIX', 'CARD'], nullable: true },
    paidAt: { type: 'string', format: 'date-time', nullable: true },
    canceledAt: { type: 'string', format: 'date-time', nullable: true },
    cancelReason: { type: 'string', nullable: true },
    client: { type: 'object' },
    barber: { type: 'object' },
    service: { type: 'object' },
  },
};

const bearerSecurity = [{ bearerAuth: [] }];

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Barber Time API',
    version: '1.0.0',
    description: 'API de agendamento do Barber Time.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: userSchema,
      Service: serviceSchema,
      Barber: barberSchema,
      BusinessHours: businessHoursSchema,
      TimeOff: timeOffSchema,
      Appointment: appointmentSchema,
      Error: errorSchema,
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Cria uma conta de cliente',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          201: { description: 'Usuário criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          400: errorResponse('Dados inválidos'),
          409: errorResponse('E-mail já cadastrado'),
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Autentica e devolve um token JWT',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Login efetuado' },
          401: errorResponse('E-mail ou senha inválidos'),
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Retorna o usuário autenticado',
        security: bearerSecurity,
        responses: {
          200: { description: 'Usuário atual', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: errorResponse('Sessão inválida ou expirada'),
        },
      },
    },
    '/users': {
      get: {
        summary: 'Lista usuários (ADMIN)',
        security: bearerSecurity,
        responses: { 200: { description: 'Lista de usuários' } },
      },
      post: {
        summary: 'Cria um usuário (ADMIN)',
        security: bearerSecurity,
        responses: { 201: { description: 'Usuário criado' } },
      },
    },
    '/users/{id}': {
      patch: {
        summary: 'Atualiza um usuário (ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Usuário atualizado' }, 404: errorResponse('Usuário não encontrado') },
      },
    },
    '/services': {
      get: {
        summary: 'Lista serviços',
        responses: { 200: { description: 'Lista de serviços' } },
      },
      post: {
        summary: 'Cria um serviço (ADMIN)',
        security: bearerSecurity,
        responses: { 201: { description: 'Serviço criado' } },
      },
    },
    '/services/{id}': {
      patch: {
        summary: 'Atualiza um serviço (ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Serviço atualizado' } },
      },
      delete: {
        summary: 'Desativa um serviço (ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Serviço desativado' } },
      },
    },
    '/barbers': {
      get: {
        summary: 'Lista barbeiros ativos',
        responses: { 200: { description: 'Lista de barbeiros' } },
      },
    },
    '/business-hours': {
      get: {
        summary: 'Horário de funcionamento (7 dias)',
        responses: { 200: { description: 'Horário de funcionamento' } },
      },
      put: {
        summary: 'Substitui o horário de funcionamento (ADMIN)',
        security: bearerSecurity,
        responses: {
          200: { description: 'Horário atualizado' },
          409: errorResponse('Conflita com agendamentos futuros'),
        },
      },
    },
    '/availability': {
      get: {
        summary: 'Lista horários livres de um barbeiro para um serviço em uma data',
        parameters: [
          { name: 'barberId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'serviceId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Horários disponíveis' },
          404: errorResponse('Barbeiro ou serviço não encontrado'),
        },
      },
    },
    '/appointments': {
      get: {
        summary: 'Lista agendamentos (escopo depende do perfil)',
        security: bearerSecurity,
        responses: { 200: { description: 'Lista de agendamentos' } },
      },
      post: {
        summary: 'Cria um agendamento',
        security: bearerSecurity,
        responses: {
          201: { description: 'Agendamento criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Appointment' } } } },
          409: errorResponse('Horário indisponível ou conflito de agenda'),
        },
      },
    },
    '/appointments/{id}/cancel': {
      patch: {
        summary: 'Cancela um agendamento',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Agendamento cancelado' },
          422: errorResponse('Fora da janela de cancelamento'),
        },
      },
    },
    '/appointments/{id}/complete': {
      patch: {
        summary: 'Marca um agendamento como concluído (BARBER/ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Agendamento concluído' } },
      },
    },
    '/appointments/{id}/no-show': {
      patch: {
        summary: 'Marca falta do cliente (BARBER/ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Falta registrada' } },
      },
    },
    '/time-off': {
      get: {
        summary: 'Lista bloqueios de agenda (BARBER/ADMIN)',
        security: bearerSecurity,
        responses: { 200: { description: 'Lista de bloqueios' } },
      },
      post: {
        summary: 'Cria um bloqueio de agenda (BARBER/ADMIN)',
        security: bearerSecurity,
        responses: {
          201: { description: 'Bloqueio criado' },
          409: errorResponse('Conflita com agendamentos futuros'),
        },
      },
    },
    '/time-off/{id}': {
      delete: {
        summary: 'Remove um bloqueio de agenda (BARBER/ADMIN)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Bloqueio removido' } },
      },
    },
  },
};
