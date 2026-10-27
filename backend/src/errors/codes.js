// Fonte única dos códigos de erro: code -> { status, message padrão }.
const codes = {
  VALIDATION_ERROR: { status: 400, message: 'Dados inválidos' },
  UNAUTHORIZED: { status: 401, message: 'Sessão inválida ou expirada' },
  INVALID_CREDENTIALS: { status: 401, message: 'E-mail ou senha inválidos' },
  FORBIDDEN: { status: 403, message: 'Você não tem permissão para esta ação' },
  CORS_NOT_ALLOWED: { status: 403, message: 'Origem não permitida' },
  NOT_FOUND: { status: 404, message: 'Recurso não encontrado' },
  EMAIL_IN_USE: { status: 409, message: 'E-mail já cadastrado' },
  SLOT_UNAVAILABLE: { status: 409, message: 'Horário indisponível' },
  CLIENT_SCHEDULE_CONFLICT: {
    status: 409,
    message: 'Você já possui um agendamento neste horário',
  },
  CONFLICTING_APPOINTMENTS: {
    status: 409,
    message: 'A alteração conflita com agendamentos futuros',
  },
  CANCELLATION_WINDOW_CLOSED: {
    status: 422,
    message: 'Cancelamento permitido somente até 2 horas antes do horário',
  },
  APPOINTMENT_NOT_STARTED: {
    status: 422,
    message: 'O agendamento ainda não começou',
  },
  INVALID_STATUS_TRANSITION: {
    status: 422,
    message: 'Ação não permitida para o status atual do agendamento',
  },
  CANNOT_MODIFY_SELF: {
    status: 422,
    message: 'Você não pode desativar ou rebaixar a si mesmo',
  },
  INTERNAL_ERROR: { status: 500, message: 'Erro interno do servidor' },
};

module.exports = { codes };
