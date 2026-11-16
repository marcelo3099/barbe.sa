# Barber Time — Backend

API REST para o agendamento da barbearia (Express 5 + Sequelize/Postgres), com RBAC, JWT, bcrypt, validação com Zod, CORS, erros padronizados e documentação Swagger.

## Pré-requisitos

- Node 22
- PostgreSQL local (ou acessível via rede), com um usuário e senha conhecidos

## Configuração

```bash
cd backend
npm install
cp .env.example .env
```

Edite `backend/.env` com as credenciais reais do seu Postgres (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) e defina `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. O arquivo `.env` nunca é versionado.

```bash
npm run db:create    # cria o banco de desenvolvimento (barber_time)
npm run db:migrate   # roda as migrations
npm run seed         # cria o admin, os 7 dias de horário e os serviços/barbeiro demo
npm run dev          # inicia a API em http://localhost:3333
```

## Testes

```bash
npm test
```

Os testes de integração usam um banco de teste separado (`barber_time_test`, ou o valor de `DB_NAME_TEST`), criado automaticamente pelo `globalSetup` se ele não existir. É necessário que `DB_USER`/`DB_PASSWORD` no `.env` consigam autenticar nesse Postgres.

## Documentação da API

Com o servidor rodando:

- Swagger UI: `http://localhost:3333/docs`
- Documento OpenAPI (JSON): `http://localhost:3333/docs.json`

## Códigos de erro

Toda resposta de erro tem o formato `{ "error": { "code", "message", "details"? } }`.

| HTTP | code | quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | corpo/query/params inválidos |
| 401 | `UNAUTHORIZED` | sem token, token inválido/expirado, ou usuário inativo/inexistente |
| 401 | `INVALID_CREDENTIALS` | login com e-mail/senha incorretos ou usuário inativo |
| 403 | `FORBIDDEN` | perfil sem permissão, ou recurso de outra pessoa |
| 403 | `CORS_NOT_ALLOWED` | origem fora da allowlist |
| 404 | `NOT_FOUND` | recurso ou rota inexistente |
| 409 | `EMAIL_IN_USE` | e-mail já cadastrado |
| 409 | `SLOT_UNAVAILABLE` | horário não está mais disponível |
| 409 | `CLIENT_SCHEDULE_CONFLICT` | cliente já tem um agendamento no horário |
| 409 | `CONFLICTING_APPOINTMENTS` | a mudança conflitaria com agendamentos futuros |
| 422 | `CANCELLATION_WINDOW_CLOSED` | cliente cancelando a menos de 2h do início |
| 422 | `APPOINTMENT_NOT_STARTED` | concluir/marcar falta antes do horário marcado |
| 422 | `INVALID_STATUS_TRANSITION` | ação sobre agendamento que não está `SCHEDULED` |
| 422 | `CANNOT_MODIFY_SELF` | admin tentando desativar ou rebaixar a si mesmo |
| 500 | `INTERNAL_ERROR` | erro inesperado |

## Exemplos de uso (curl)

Cadastro e login:

```bash
curl -X POST http://localhost:3333/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana","email":"ana@example.com","password":"senha1234"}'

curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"senha1234"}'
```

Disponibilidade de horários:

```bash
curl "http://localhost:3333/api/availability?barberId=1&serviceId=1&date=2026-11-03"
```

Criar um agendamento (com o token retornado no login):

```bash
curl -X POST http://localhost:3333/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"serviceId":1,"barberId":1,"startsAt":"2026-11-03T10:00:00-03:00"}'
```

Cancelar um agendamento:

```bash
curl -X PATCH http://localhost:3333/api/appointments/1/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"reason":"Imprevisto"}'
```
