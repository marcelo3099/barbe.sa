# Barber Time — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REST API do Barber Time (agendamento de uma barbearia) com RBAC, JWT, bcrypt, Zod, CORS, erros padronizados e Swagger, desenvolvida com TDD.

**Architecture:** Express 5 em camadas `routes → controllers → services → repositories → models (Sequelize)`. Regras de horário ficam numa função pura (`computeSlots`) reutilizada pela disponibilidade e pela criação do agendamento, que revalida dentro de uma transação com `SELECT ... FOR UPDATE`. Datas são `TIMESTAMPTZ` no Postgres e convertidas para ISO com offset de `America/Sao_Paulo` só nos serializers.

**Tech Stack:** Node 22, Express 5, Sequelize 6 + pg, sequelize-cli (migrations), Zod 3, jsonwebtoken, bcrypt, cors, luxon, dotenv, swagger-ui-express; Jest + Supertest. CommonJS (`require`), JavaScript puro.

**Spec:** `docs/superpowers/specs/2026-10-27-barber-time-design.md` (seções 5, 6, 7, 7.1 e 9 são as que importam aqui).

## Global Constraints

- Trabalhar só em `backend/` e neste arquivo. Nunca tocar em `frontend/`. Commits com `git add backend/ docs/superpowers/plans/2026-10-27-barber-time-backend.md` — **nunca** `git add -A` / `git add .` (outra sessão commita `frontend/` no mesmo repo).
- O contrato da seção 7.1 do spec é fixo: chaves camelCase, sucesso sem envelope `data`, erro sempre `{ "error": { "code", "message", "details"? } }`, datas ISO 8601 com offset (`2026-11-03T10:30:00-03:00`, sem milissegundos), datas puras `YYYY-MM-DD`, horas `HH:mm`, dinheiro em centavos inteiros.
- Prefixo `/api`; porta padrão `3333`; `CORS_ORIGIN` padrão `http://localhost:5173` (lista separada por vírgula). Requisição sem header `Origin` (curl, Supertest) é aceita; origem fora da lista → `403 CORS_NOT_ALLOWED`.
- Fuso `America/Sao_Paulo`. Grade de 15 min, antecedência mínima 30 min, reserva até 60 dias, cancelamento do cliente até 2 h antes.
- JWT: payload `{ sub, role }`, `JWT_EXPIRES_IN` padrão `2h`. bcrypt custo 10 (custo 4 quando `NODE_ENV=test`). Senha: mín. 8, máx. 72 caracteres.
- `passwordHash` nunca aparece em resposta nenhuma.
- Mensagens de erro (`message`) em português.
- `.env` nunca é versionado (já está no `.gitignore` da raiz). `backend/.env.example` só com placeholders — nenhuma senha real em arquivo versionado.
- Banco de teste `barber_time_test`; dev `barber_time`. Testes: `jest --runInBand`.
- Toda rota protegida tem testes de "sem token" (401), "perfil errado" (403) e, onde houver dono, "recurso de outra pessoa" (403).

### Códigos de erro (fonte única: `src/errors/codes.js`)

| HTTP | code | quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod falhou; `details` = `{ campo: [mensagens] }` |
| 401 | `UNAUTHORIZED` | sem token, token inválido/expirado, usuário do token inativo ou inexistente |
| 401 | `INVALID_CREDENTIALS` | login com e-mail inexistente, senha errada ou usuário inativo |
| 403 | `FORBIDDEN` | perfil sem permissão ou recurso de outra pessoa |
| 403 | `CORS_NOT_ALLOWED` | origem fora da allowlist |
| 404 | `NOT_FOUND` | recurso/rota inexistente |
| 409 | `EMAIL_IN_USE` | e-mail já cadastrado |
| 409 | `SLOT_UNAVAILABLE` | horário não está entre os livres (regras 5.3) no momento da reserva |
| 409 | `CLIENT_SCHEDULE_CONFLICT` | cliente já tem SCHEDULED sobreposto |
| 409 | `CONFLICTING_APPOINTMENTS` | mudança deixaria SCHEDULED futuros em conflito; `details` = lista de Appointment |
| 422 | `CANCELLATION_WINDOW_CLOSED` | cliente cancelando a menos de 2 h |
| 422 | `APPOINTMENT_NOT_STARTED` | complete/no-show antes de `startsAt` |
| 422 | `INVALID_STATUS_TRANSITION` | ação sobre agendamento que não está SCHEDULED |
| 422 | `CANNOT_MODIFY_SELF` | ADMIN desativando ou rebaixando a si mesmo |
| 500 | `INTERNAL_ERROR` | erro inesperado; sem stack na resposta |

### Decisões que o spec deixou abertas (fixadas aqui; avisar a sessão do front)

- `DELETE /services/:id` → `200` com o Service desativado. `DELETE /time-off/:id` → `204`.
- `GET /services?includeInactive=true` devolve também inativos **só** se o token for de ADMIN; sem token ou outro perfil, o parâmetro é ignorado.
- `GET /users?role=BARBER|CLIENT|ADMIN` (filtro opcional), ordenado por nome. `GET /barbers` ordenado por nome.
- `GET /availability`: barbeiro ou serviço inexistente → `404`; inativo, dia fechado, data passada ou > 60 dias → `200 { date, slots: [] }`.
- `POST /appointments`: barbeiro ou serviço inexistente/inativo → `404`; CLIENT enviando `clientId` diferente do próprio → `403`; BARBER/ADMIN sem `clientId` → `400`; `clientId` que não é CLIENT ativo → `404`.
- `GET /appointments` filtros: `from`, `to` (`YYYY-MM-DD`, inclusivos, no fuso SP), `status`, `barberId`. BARBER sempre restrito à própria agenda (o `barberId` dele prevalece).
- `GET /time-off`: BARBER vê os próprios; ADMIN vê todos (filtro `barberId` opcional). Ordem por `startsAt`.
- `PATCH /users/:id` que desativa um BARBER **ou** muda o perfil de um BARBER com SCHEDULED futuros → `409 CONFLICTING_APPOINTMENTS`.
- Horas de BusinessHours e TimeOff precisam cair na grade de 15 min (minutos 00/15/30/45).

## Review Focus

1. **Corrida na reserva:** dois `POST /appointments` simultâneos para o mesmo barbeiro/horário → exatamente um `201` e um `409 SLOT_UNAVAILABLE` (Task 10).
2. **Fuso na virada do dia:** um agendamento às 22:30 de SP é 01:30 UTC do dia seguinte; filtros `from/to` e a disponibilidade têm que usar o dia de SP, não o dia UTC (Tasks 4, 11).
3. **Token de usuário desativado:** um JWT ainda válido de um usuário que o ADMIN desativou tem que dar `401` na próxima chamada (Task 5).
4. **Valores de borda no corpo:** `priceCents` negativo ou fracionário, `durationMinutes` 0/250/20, senha com 73 caracteres, `startsAt` sem offset, `weekday` repetido no PUT de horários → `400 VALIDATION_ERROR` (Tasks 5, 7, 8, 10).
5. **Serviço desativado com agendamentos:** desativar o serviço não altera nem esconde agendamentos já feitos; o agendamento continua listável, cancelável e concluível (Task 11).

---

## File Structure

```
backend/
  package.json  jest.config.js  .sequelizerc  .env.example  README.md
  src/
    app.js                     createApp(): monta middlewares, /api router, /docs, 404 e errorHandler
    server.js                  lê env e chama app.listen(PORT)
    config/env.js              objeto `env` com defaults e troca DB_NAME→DB_NAME_TEST em teste
    config/database.js         config do sequelize-cli (development/test)
    database/migrations/       uma migration por tabela
    database/seed.js           seed(): admin do .env, 7 BusinessHours, serviços e barbeiro demo
    models/index.js            sequelize + User, Service, BusinessHours, TimeOff, Appointment + associações
    errors/AppError.js         class AppError
    errors/codes.js            mapa code → { status, message }
    middlewares/{errorHandler,notFound,validate,authenticate,authorize,optionalAuth,cors}.js
    schemas/                   um arquivo Zod por recurso
    utils/clock.js             { now() }  — único ponto de “agora”, mockável
    utils/time.js              conversões de fuso e formatação
    utils/password.js          hashPassword, comparePassword
    utils/jwt.js               signToken, verifyToken
    domain/slots.js            computeSlots (puro)
    serializers/index.js       userJson, serviceJson, barberJson, timeOffJson, appointmentJson, businessHoursJson
    repositories/              userRepository, serviceRepository, businessHoursRepository, timeOffRepository, appointmentRepository
    services/                  authService, userService, serviceService, businessHoursService, availabilityService, appointmentService, timeOffService
    controllers/               um por recurso
    routes/                    index.js + um por recurso
    docs/openapi.js            documento OpenAPI 3
  tests/
    globalSetup.js             cria barber_time_test se não existir
    setupEnv.js                NODE_ENV=test + dotenv
    helpers/{db,factories,api,clock}.js
    unit/  integration/
```

---

### Task 1: Scaffold, config, conexão com o banco e health check

**Files:**
- Create: `backend/package.json`, `backend/jest.config.js`, `backend/.env.example`, `backend/src/config/env.js`, `backend/src/models/index.js` (só a instância `sequelize` por enquanto), `backend/src/app.js`, `backend/src/server.js`, `backend/src/routes/index.js`, `backend/tests/globalSetup.js`, `backend/tests/setupEnv.js`, `backend/tests/helpers/api.js`
- Test: `backend/tests/integration/health.test.js`

**Interfaces:**
- Produces: `env` (`{ nodeEnv, port, jwtSecret, jwtExpiresIn, corsOrigins: string[], db: { host, port, user, password, name }, adminEmail, adminPassword, bcryptCost }`); `createApp(): express.Application`; `sequelize` exportado por `src/models/index.js`; `api` = `supertest(createApp())` em `tests/helpers/api.js`.

- [ ] **Step 1: `npm init` e dependências**

```bash
cd backend
npm init -y
npm i express@5 sequelize pg pg-hstore zod@3 jsonwebtoken bcrypt cors luxon dotenv swagger-ui-express
npm i -D jest supertest sequelize-cli
```
Scripts: `"test": "jest --runInBand"`, `"dev": "node --watch src/server.js"`, `"start": "node src/server.js"`, `"db:create": "sequelize-cli db:create"`, `"db:migrate": "sequelize-cli db:migrate"`, `"seed": "node src/database/seed.js"`.

`jest.config.js`: `testEnvironment: 'node'`, `globalSetup: './tests/globalSetup.js'`, `setupFiles: ['./tests/setupEnv.js']`.

`.env.example` (placeholders, nada real):
```
PORT=3333
JWT_SECRET=troque-por-um-segredo-longo
JWT_EXPIRES_IN=2h
CORS_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-aqui
DB_NAME=barber_time
DB_NAME_TEST=barber_time_test
ADMIN_EMAIL=admin@barbertime.local
ADMIN_PASSWORD=troque-esta-senha
```
O `.env` real (com as credenciais que o usuário passar) é criado em `backend/.env` e **não** é commitado.

`tests/setupEnv.js`: `process.env.NODE_ENV = 'test'` antes de `require('dotenv').config()`.
`tests/globalSetup.js`: com `pg.Client` conectado ao banco `postgres`, roda `CREATE DATABASE barber_time_test` se `SELECT 1 FROM pg_database WHERE datname = $1` vier vazio.

- [ ] **Step 2: Teste que falha**

```js
// tests/integration/health.test.js
const { api } = require('../helpers/api');
const { sequelize } = require('../../src/models');

afterAll(() => sequelize.close());

test('GET /api/health responde 200 { status: "ok" }', async () => {
  const res = await api.get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('conecta no banco de teste', async () => {
  await expect(sequelize.authenticate()).resolves.toBeUndefined();
  expect(sequelize.getDatabase()).toBe('barber_time_test');
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test -- health` → FAIL (`Cannot find module '../../src/app'` ou similar).

- [ ] **Step 4: Implementar** `env.js` (em `NODE_ENV=test`: `db.name = DB_NAME_TEST`, `bcryptCost = 4`), `models/index.js` (`new Sequelize(name, user, password, { host, port, dialect: 'postgres', logging: false, define: { underscored: true } })`), `createApp()` com `express.json()` e o router em `/api`, rota `GET /health`. `server.js` faz `createApp().listen(env.port)`.

- [ ] **Step 5: Rodar e ver passar** — `npm test` → PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/ docs/superpowers/plans/2026-10-27-barber-time-backend.md
git commit -m "chore(backend): scaffold express app, config and test database"
```
Antes do commit, confirmar com `git status` que `backend/.env` **não** está na lista.

---

### Task 2: Erros padronizados, validação Zod, 404 e CORS

**Files:**
- Create: `src/errors/AppError.js`, `src/errors/codes.js`, `src/middlewares/errorHandler.js`, `src/middlewares/notFound.js`, `src/middlewares/validate.js`, `src/middlewares/cors.js`
- Modify: `src/app.js`
- Test: `tests/unit/validate.test.js`, `tests/integration/errors.test.js`

**Interfaces:**
- Produces:
  - `class AppError extends Error { constructor(status, code, message, details?) }` e helper `AppError.of(code, details?)` que busca `status` e `message` em `codes.js` (ex.: `AppError.of('NOT_FOUND')`, mensagem padrão "Recurso não encontrado"). Mensagem pode ser sobrescrita: `AppError.of('NOT_FOUND', undefined, 'Barbeiro não encontrado')`.
  - `validate({ body?, params?, query? })` — middleware que faz `schema.parse` e substitui `req.body`/`req.params` pelo resultado; para `query` grava em `req.validatedQuery` (no Express 5 `req.query` é getter). Falha → `AppError(400, 'VALIDATION_ERROR', 'Dados inválidos', details)` com `details` = `{ [campo]: string[] }` (usar `error.flatten().fieldErrors`; para erro na raiz use a chave `_root`).
  - `errorHandler(err, req, res, next)` — `AppError` → `{ error: { code, message, details } }` (omite `details` quando `undefined`); JSON malformado (`err.type === 'entity.parse.failed'`) → 400 `VALIDATION_ERROR`; resto → `500 INTERNAL_ERROR` "Erro interno do servidor" e `console.error(err)` (exceto em teste).
  - `notFound` → `404 NOT_FOUND` "Rota não encontrada".

- [ ] **Step 1: Testes que falham**

`tests/unit/validate.test.js`: monta `validate({ body: z.object({ email: z.string().email('E-mail inválido') }) })`, chama com `req.body = { email: 'x' }` e um `next` espião; espera `next` chamado com `AppError` de `status 400`, `code 'VALIDATION_ERROR'`, `details { email: ['E-mail inválido'] }`. Com corpo válido, `next()` sem argumento e `req.body` já parseado (campos extras removidos).

`tests/integration/errors.test.js` (usa `createApp` com uma rota de teste montada só aqui não é possível — então testar via comportamento real):
- `GET /api/rota-que-nao-existe` → 404, `body.error.code === 'NOT_FOUND'`.
- `POST /api/health` com corpo `'{"a":'` e `Content-Type: application/json` → 400 `VALIDATION_ERROR`.
- `GET /api/health` com `Origin: http://localhost:5173` → 200 e header `access-control-allow-origin` = `http://localhost:5173`.
- `GET /api/health` com `Origin: http://evil.com` → 403 `CORS_NOT_ALLOWED`.
- Unit em `errors.test.js`: `errorHandler(new Error('boom'), ...)` com `res` fake → status 500, corpo `{ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } }`, sem `stack`.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- errors validate` → FAIL.
- [ ] **Step 3: Implementar** os arquivos acima. `cors.js` usa o pacote `cors` com `origin(origin, cb)`: sem `origin` ou presente em `env.corsOrigins` → `cb(null, true)`; senão `cb(AppError.of('CORS_NOT_ALLOWED'))`. Ordem em `createApp`: cors → `express.json()` → `/api` → notFound → errorHandler.
- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): standardized errors, zod validation and cors"`

---

### Task 3: Models, migrations e helpers de teste

**Files:**
- Create: `src/models/{User,Service,BusinessHours,TimeOff,Appointment}.js`, `src/config/database.js`, `.sequelizerc`, `src/database/migrations/2026102700000{1..5}-create-*.js`, `tests/helpers/{db,factories,clock}.js`, `src/utils/clock.js`
- Modify: `src/models/index.js`
- Test: `tests/integration/models.test.js`, `tests/integration/migrations.test.js`

**Interfaces:**
- Produces (models, `underscored: true`, tabelas `users`, `services`, `business_hours`, `time_offs`, `appointments`):
  - `User { id, name, email (unique), phone (null), passwordHash, role ENUM('ADMIN','BARBER','CLIENT'), active (default true) }`
  - `Service { id, name, description (TEXT, default ''), priceCents INTEGER, durationMinutes INTEGER, active (default true) }`
  - `BusinessHours { weekday INTEGER PK (0–6), opensAt STRING(5), closesAt STRING(5), breakStartsAt STRING(5) null, breakEndsAt STRING(5) null, closed BOOLEAN }` — sem timestamps.
  - `TimeOff { id, barberId → users, startsAt DATE, endsAt DATE, reason STRING null }`
  - `Appointment { id, clientId → users, barberId → users, serviceId → services, startsAt DATE, endsAt DATE, priceCents, status ENUM('SCHEDULED','COMPLETED','CANCELED','NO_SHOW') default SCHEDULED, paymentMethod ENUM('CASH','PIX','CARD') null, paidAt null, canceledAt null, cancelReason null }`, índice em `(barber_id, starts_at)` e `(client_id, starts_at)`.
  - Associações: `Appointment.belongsTo(User, { as: 'client' })`, `{ as: 'barber' }`, `Appointment.belongsTo(Service, { as: 'service' })`, `TimeOff.belongsTo(User, { as: 'barber' })`.
  - `clock = { now: () => new Date() }` em `src/utils/clock.js`. **Todo** código de produção usa `clock.now()`, nunca `new Date()` sem argumento nem `Date.now()`.
  - `tests/helpers/db.js`: `resetDb()` = `sequelize.sync({ force: true })`; `closeDb()`.
  - `tests/helpers/clock.js`: `freezeNow(iso: string)` = `jest.spyOn(clock, 'now').mockReturnValue(new Date(iso))`. Data padrão dos testes: `NOW = '2026-11-02T08:00:00-03:00'` (segunda-feira).
  - `tests/helpers/factories.js`:
    - `createUser({ role = 'CLIENT', name, email, password = 'senha1234', active = true, phone }) → { user, token, password }` (token via `signToken` da Task 5 — nesta task exporte só a criação; `token` é adicionado na Task 5).
    - `createService({ name = 'Corte clássico', priceCents = 4500, durationMinutes = 30, active = true, description = '' }) → Service`
    - `setDefaultHours()` → seg–sáb (`weekday` 1–6) `09:00–18:00`, intervalo `12:00–13:00`; domingo (`0`) `closed: true` com `opensAt '00:00'`, `closesAt '00:00'`.
    - `createAppointment({ client, barber, service, startsAt (ISO), status = 'SCHEDULED' }) → Appointment` (insere direto no model; `endsAt` = início + duração; `priceCents` do serviço).
    - `createTimeOff({ barber, startsAt, endsAt, reason }) → TimeOff`

- [ ] **Step 1: Testes que falham**

`models.test.js` (`beforeEach(resetDb)`): cria usuário, serviço, horários padrão, um agendamento e um timeoff pelos factories; `Appointment.findByPk(id, { include: ['client','barber','service'] })` traz os três; dois usuários com o mesmo e-mail → rejeita com `SequelizeUniqueConstraintError`.

`migrations.test.js`: `await sequelize.getQueryInterface().dropAllTables()`, depois `await sequelize.query('DROP TYPE IF EXISTS ... CASCADE')` para os ENUMs (ou `dropAllEnums()`), roda `execSync('npx sequelize-cli db:migrate --env test', { cwd: backendDir })`, e para cada model compara `Object.keys(await queryInterface.describeTable(Model.getTableName())).sort()` com os `field` de `Model.getAttributes()` ordenados. Termina com `resetDb()` para deixar o banco como os outros testes esperam.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- models migrations` → FAIL.
- [ ] **Step 3: Implementar** models, associações, migrations (`createTable` com `snake_case`, FKs com `onDelete: 'RESTRICT'`, timestamps `created_at`/`updated_at` exceto `business_hours`), `.sequelizerc` apontando `config` para `src/config/database.js` e `migrations-path` para `src/database/migrations`. `src/config/database.js` exporta `{ development: {...}, test: {...} }` a partir de `env` (com `dialect: 'postgres'`).
- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): sequelize models, migrations and test factories"`

---

### Task 4: Utilitários de fuso e `computeSlots` (função pura)

**Files:**
- Create: `src/utils/time.js`, `src/domain/slots.js`
- Test: `tests/unit/time.test.js`, `tests/unit/slots.test.js`

**Interfaces:**
- Produces (`src/utils/time.js`, com luxon, `TZ = 'America/Sao_Paulo'`):
  - `toIso(date: Date) → string` — ex.: `toIso(new Date('2026-11-03T13:30:00Z')) === '2026-11-03T10:30:00-03:00'` (sem milissegundos).
  - `localDateOf(date: Date) → 'YYYY-MM-DD'` no fuso SP.
  - `atLocal(date: 'YYYY-MM-DD', hhmm: 'HH:mm') → Date`.
  - `weekdayOf(date: 'YYYY-MM-DD') → 0..6` (domingo = 0).
  - `startOfLocalDay(date) → Date`, `endOfLocalDay(date) → Date` (início do dia seguinte, exclusivo).
  - `addMinutes(date: Date, n) → Date`, `addDaysToLocalDate(date: 'YYYY-MM-DD', n) → 'YYYY-MM-DD'`.
  - `overlaps(aStart, aEnd, bStart, bEnd) → boolean` — `aStart < bEnd && bStart < aEnd`.
- Produces (`src/domain/slots.js`):
  - `computeSlots({ date, now, hours, durationMinutes, busy }) → Date[]`
    - `date`: `'YYYY-MM-DD'`; `now`: `Date`; `hours`: BusinessHours do weekday da data (`{ opensAt, closesAt, breakStartsAt, breakEndsAt, closed }`) ou `null`; `busy`: `Array<{ start: Date, end: Date }>` (agendamentos não cancelados + timeoffs).
    - Gera inícios de `opensAt` a `closesAt - duração` a cada 15 min e mantém H quando: `H >= now + 30min`; `date <= localDateOf(now) + 60 dias`; não fechado; `[H, H+dur]` não sobrepõe o intervalo de almoço; não sobrepõe nada em `busy`.
  - `isSlotFree(args, startsAt: Date) → boolean` — `computeSlots(args).some(s => s.getTime() === startsAt.getTime())`.

- [ ] **Step 1: Testes que falham**

`time.test.js`: o exemplo de `toIso` acima; `localDateOf(new Date('2026-11-04T01:30:00Z')) === '2026-11-03'` (22:30 em SP — Review Focus 2); `atLocal('2026-11-03','09:00').toISOString() === '2026-11-03T12:00:00.000Z'`; `weekdayOf('2026-11-03') === 2`; `overlaps` com fim == início → `false`.

`slots.test.js` (horas `{ opensAt:'09:00', closesAt:'18:00', breakStartsAt:'12:00', breakEndsAt:'13:00', closed:false }`, `now = 2026-11-02T08:00-03:00`, `date = '2026-11-03'`, 30 min):
- sem `busy` → 30 slots; primeiro `09:00-03:00`, último `17:30-03:00`; inclui `11:30`, não inclui `11:45`, `12:00`, `12:30`; inclui `13:00`.
- `busy` com `[10:00, 10:30)` → não tem `09:45` nem `10:00`, tem `09:30` e `10:30`.
- `closed: true` ou `hours: null` → `[]`.
- `now = 2026-11-03T09:10-03:00` → primeiro slot `09:45` (09:40 arredonda para a próxima grade, ≥ now+30).
- `date` passada (`'2026-11-01'`) → `[]`; `date = '2027-01-01'` (60 dias depois de 02/11 é 01/01/2027) → não vazio; `'2027-01-02'` → `[]`.
- serviço de 60 min → não tem `11:15` (pega o almoço), tem `11:00`, último `17:00`.
- `isSlotFree` com `10:05` (fora da grade) → `false`.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- time slots` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): timezone helpers and slot computation"`

---

### Task 5: Autenticação (register, login, me) e middlewares de RBAC

**Files:**
- Create: `src/utils/password.js`, `src/utils/jwt.js`, `src/serializers/index.js` (começa com `userJson`), `src/repositories/userRepository.js`, `src/services/authService.js`, `src/controllers/authController.js`, `src/routes/auth.routes.js`, `src/schemas/auth.schemas.js`, `src/middlewares/{authenticate,authorize,optionalAuth}.js`
- Modify: `src/routes/index.js`, `tests/helpers/factories.js` (`createUser` passa a devolver `token`)
- Test: `tests/unit/authorize.test.js`, `tests/integration/auth.test.js`

**Interfaces:**
- Produces:
  - `hashPassword(plain) → Promise<string>` (custo `env.bcryptCost`), `comparePassword(plain, hash) → Promise<boolean>`.
  - `signToken(user) → string` (`{ sub: user.id, role: user.role }`, `expiresIn: env.jwtExpiresIn`), `verifyToken(token) → { sub, role }` (lança em inválido/expirado).
  - `authenticate` — lê `Authorization: Bearer <t>`, verifica, busca o usuário **no banco**; ausente/inválido/inexistente/inativo → `401 UNAUTHORIZED` "Sessão inválida ou expirada". Define `req.user = { id, role }` (role do banco, não do token).
  - `optionalAuth` — igual, mas sem header segue sem `req.user`; header inválido → segue sem `req.user`.
  - `authorize(...roles)` — `req.user.role` fora da lista → `403 FORBIDDEN` "Você não tem permissão para esta ação".
  - `userJson(user) → { id, name, email, phone, role, active }`.
  - `userRepository`: `findById(id)`, `findByEmail(email)`, `create(data)`, `update(user, data)`, `list({ role? })`.
  - `authService`: `register({ name, email, password, phone }) → User`, `login({ email, password }) → { token, user }`, `me(userId) → User`.
- Schemas: `registerSchema` = `{ name: string trim min 2 max 100, email: email → trim().toLowerCase(), password: string min 8 max 72, phone?: string regex /^\d{10,11}$/ }`; `loginSchema` = `{ email, password: string min 1 }`.

- [ ] **Step 1: Testes que falham**

`authorize.test.js`: `authorize('ADMIN')` com `req.user.role = 'CLIENT'` → `next(AppError 403 FORBIDDEN)`; com `'ADMIN'` → `next()`.

`auth.test.js` (`beforeEach(resetDb)`; `afterAll(closeDb)`):
- register válido → 201, corpo exatamente `{ id, name, email, phone, role: 'CLIENT', active: true }` (sem `password`/`passwordHash`); no banco o `password_hash` começa com `$2` e não é a senha.
- register com `role: 'ADMIN'` no corpo → 201 e `role === 'CLIENT'`.
- register com e-mail `' Ana@X.com '` → salvo como `ana@x.com`; segundo register com `ana@x.com` → 409 `EMAIL_IN_USE`.
- register com senha de 7 e de 73 caracteres → 400 `VALIDATION_ERROR` com `details.password`; e-mail inválido → `details.email`.
- login correto → 200 `{ token, user }`; `verifyToken(token)` tem `sub` e `role`.
- login com senha errada e com e-mail inexistente → ambos 401 `INVALID_CREDENTIALS` e **mesma** `message`.
- login de usuário inativo → 401 `INVALID_CREDENTIALS`.
- `GET /auth/me` sem token → 401 `UNAUTHORIZED`; com token `'abc'` → 401; com token expirado (`jwt.sign({ sub, role }, env.jwtSecret, { expiresIn: -10 })`) → 401; com token válido → 200 User.
- token válido de usuário que depois foi desativado (`user.update({ active: false })`) → `GET /auth/me` 401 (Review Focus 3).

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (rotas: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` com `authenticate`). Controller só chama o service e serializa; service lança `AppError`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): jwt auth, bcrypt and rbac middlewares"`

---

### Task 6: Usuários (ADMIN)

**Files:**
- Create: `src/services/userService.js`, `src/controllers/userController.js`, `src/routes/users.routes.js`, `src/schemas/user.schemas.js`, `src/repositories/appointmentRepository.js` (começa com `findFutureScheduled`), `src/serializers/index.js` (adiciona `appointmentJson`)
- Test: `tests/integration/users.test.js`

**Interfaces:**
- Consumes: `authenticate`, `authorize`, `userRepository`, `hashPassword`, factories.
- Produces:
  - `appointmentRepository.findFutureScheduled({ barberId?, clientId?, from: Date }) → Appointment[]` (status `SCHEDULED`, `startsAt >= from`, com `include: client, barber, service`, ordenado por `startsAt`).
  - `appointmentJson(a) → { id, status, startsAt, endsAt, priceCents, paymentMethod, paidAt, canceledAt, cancelReason, client: { id, name, phone }, barber: { id, name }, service: { id, name, durationMinutes } }` — datas via `toIso`, nulos como `null`.
  - `userService`: `list({ role })`, `create(data)`, `update(actorId, id, data)`.
- Rotas (todas `authenticate, authorize('ADMIN')`): `GET /users?role=`, `POST /users` (body = registerSchema + `role` obrigatório) → 201, `PATCH /users/:id` (body parcial: `name`, `phone` (string ou `null`), `role`, `active`, `password`; pelo menos um campo) → 200 User. `:id` = inteiro positivo (`z.coerce.number().int().positive()`).

- [ ] **Step 1: Testes que falham** (`users.test.js`)
- RBAC: `GET /users` sem token → 401; com token de CLIENT e de BARBER → 403.
- ADMIN lista → 200, array sem `passwordHash`; `?role=BARBER` só barbeiros; `?role=XYZ` → 400.
- ADMIN cria BARBER → 201 com `role: 'BARBER'`; e-mail repetido → 409 `EMAIL_IN_USE`.
- ADMIN altera `name`, `phone`, `role` de outro → 200; `password: 'novasenha123'` → login com a nova senha funciona.
- ADMIN `PATCH` a si mesmo com `active: false` → 422 `CANNOT_MODIFY_SELF`; com `role: 'CLIENT'` → 422; com `name` → 200.
- `PATCH /users/9999` → 404; `PATCH /users/abc` → 400.
- Desativar BARBER com agendamento SCHEDULED futuro (`freezeNow(NOW)`, agendamento em `2026-11-03T10:00-03:00`) → 409 `CONFLICTING_APPOINTMENTS`, `details` com 1 item contendo `id` do agendamento e `startsAt: '2026-11-03T10:00:00-03:00'`; o mesmo barbeiro só com agendamento CANCELED ou passado → 200.
- Trocar `role` de BARBER com SCHEDULED futuro → 409 `CONFLICTING_APPOINTMENTS`.

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): admin user management"`

---

### Task 7: Serviços (CRUD) e `GET /barbers`

**Files:**
- Create: `src/repositories/serviceRepository.js`, `src/services/serviceService.js`, `src/controllers/{serviceController,barberController}.js`, `src/routes/{services,barbers}.routes.js`, `src/schemas/service.schemas.js`
- Modify: `src/serializers/index.js` (`serviceJson`, `barberJson`)
- Test: `tests/integration/services.test.js`, `tests/integration/barbers.test.js`

**Interfaces:**
- Produces: `serviceJson(s) → { id, name, description, priceCents, durationMinutes, active }`; `barberJson(u) → { id, name }`; `serviceRepository`: `findById`, `list({ includeInactive })`, `create`, `update`.
- Schema do serviço: `name` 2–100, `description` string máx. 500 (default `''`), `priceCents` `int().min(0)`, `durationMinutes` `int().min(15).max(240).refine(n => n % 15 === 0)`, `active` boolean (só no PATCH). PATCH parcial com pelo menos um campo.
- Rotas: `GET /services` (`optionalAuth`; `?includeInactive=true` só vale para ADMIN), `POST /services` 201, `PATCH /services/:id` 200, `DELETE /services/:id` → 200 com `active: false`. `GET /barbers` público: usuários `BARBER` ativos, ordem por nome.

- [ ] **Step 1: Testes que falham**
- `GET /services` sem token → só ativos, ordenados por nome; ADMIN com `?includeInactive=true` → inclui inativo; CLIENT com o mesmo parâmetro → só ativos.
- POST/PATCH/DELETE sem token → 401; CLIENT e BARBER → 403.
- ADMIN cria → 201 com o formato exato da 7.1.
- Review Focus 4: `priceCents: -1`, `priceCents: 10.5`, `durationMinutes: 0`, `250`, `20` → cada um 400 `VALIDATION_ERROR` com a chave do campo em `details`.
- `DELETE /services/:id` → 200 `active: false`; some do `GET /services`; id inexistente → 404.
- `GET /barbers` → só BARBER ativos, formato `{ id, name }` (sem e-mail), não inclui ADMIN/CLIENT/inativos.

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): services crud and public barbers list"`

---

### Task 8: Horário de funcionamento

**Files:**
- Create: `src/repositories/businessHoursRepository.js`, `src/services/businessHoursService.js`, `src/controllers/businessHoursController.js`, `src/routes/businessHours.routes.js`, `src/schemas/businessHours.schemas.js`
- Modify: `src/serializers/index.js` (`businessHoursJson`), `src/repositories/appointmentRepository.js`
- Test: `tests/integration/businessHours.test.js`

**Interfaces:**
- Consumes: `appointmentRepository.findFutureScheduled`, `computeSlots`/`overlaps`, `localDateOf`, `weekdayOf`, `atLocal`.
- Produces:
  - `businessHoursRepository.findAll() → BusinessHours[]` (ordem por weekday), `findByWeekday(n)`, `replaceAll(rows, transaction)`.
  - `businessHoursService.getAll()` — sempre 7 itens, `weekday` 0–6; dia sem linha vira `{ weekday, opensAt: '00:00', closesAt: '00:00', breakStartsAt: null, breakEndsAt: null, closed: true }`.
  - `businessHoursService.replace(rows)` — dentro de transação: busca SCHEDULED futuros (`from: clock.now()`), descarta os que ainda cabem no novo horário do seu weekday (aberto, `[start,end]` dentro de `opensAt/closesAt`, sem tocar o intervalo); se sobrar algum → `409 CONFLICTING_APPOINTMENTS` com `details = appointments.map(appointmentJson)`; senão grava as 7.
  - `businessHoursJson(row) → { weekday, opensAt, closesAt, breakStartsAt, breakEndsAt, closed }`.
- Schema do PUT: array de exatamente 7; `weekday` int 0–6, todos distintos; horas `/^([01]\d|2[0-3]):(00|15|30|45)$/`; quando `closed: false`: `opensAt < closesAt`; `breakStartsAt` e `breakEndsAt` ambos ou nenhum, com `opensAt <= breakStartsAt < breakEndsAt <= closesAt`. Quando `closed: true`, horas são aceitas como vierem.

- [ ] **Step 1: Testes que falham**
- `GET /business-hours` sem token → 200 com 7 itens, mesmo com tabela vazia (todos `closed: true`); após `setDefaultHours()` o weekday 2 é `{ weekday: 2, opensAt: '09:00', closesAt: '18:00', breakStartsAt: '12:00', breakEndsAt: '13:00', closed: false }`.
- PUT sem token → 401; BARBER/CLIENT → 403.
- ADMIN PUT válido → 200 com as 7 linhas; GET seguinte reflete.
- Review Focus 4: 6 itens; `weekday` repetido; `opensAt: '18:00', closesAt: '09:00'`; `opensAt: '09:10'`; só `breakStartsAt` → cada um 400.
- `freezeNow(NOW)` + agendamento SCHEDULED em ter `2026-11-03T17:00-03:00`: PUT fechando terça → 409 `CONFLICTING_APPOINTMENTS` com o agendamento em `details`; PUT mudando terça para `09:00–17:00` → 409; PUT mudando o intervalo de terça para `17:00–17:30` (com fechamento 18:00) → 409; PUT fechando quarta → 200. Agendamento CANCELED na terça não bloqueia o fechamento.

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): business hours with conflict check"`

---

### Task 9: Disponibilidade

**Files:**
- Create: `src/services/availabilityService.js`, `src/controllers/availabilityController.js`, `src/routes/availability.routes.js`, `src/schemas/availability.schemas.js`, `src/repositories/timeOffRepository.js` (começa com `findOverlapping`)
- Modify: `src/repositories/appointmentRepository.js` (adiciona `findBusyForBarber`)
- Test: `tests/integration/availability.test.js`

**Interfaces:**
- Produces:
  - `appointmentRepository.findBusyForBarber({ barberId, from: Date, to: Date, transaction? }) → Appointment[]` — status ≠ `CANCELED` e sobrepondo `[from, to)`.
  - `timeOffRepository.findOverlapping({ barberId, from, to, transaction? }) → TimeOff[]`.
  - `availabilityService.getSlotArgs({ barber, service, date, transaction? }) → args de computeSlots` (busca horas do weekday, busy do dia local inteiro via `startOfLocalDay/endOfLocalDay`, `now: clock.now()`). Reaproveitado pela Task 10.
  - `availabilityService.getAvailability({ barberId, serviceId, date }) → { date, slots: string[] }` — barbeiro (User com role BARBER) ou serviço inexistente → 404; barbeiro/serviço inativo → `slots: []`.
- Schema da query: `barberId`, `serviceId` (`z.coerce.number().int().positive()`), `date` (`/^\d{4}-\d{2}-\d{2}$/` e data válida).

- [ ] **Step 1: Testes que falham** (`freezeNow(NOW)`, `setDefaultHours()`, barbeiro e serviço de 30 min)
- `GET /api/availability?barberId&serviceId&date=2026-11-03` → 200, `body.date === '2026-11-03'`, 30 slots, `slots[0] === '2026-11-03T09:00:00-03:00'`.
- Com agendamento SCHEDULED às 10:00 → sem `09:45` e `10:00`; com ele CANCELED → `10:00` volta; COMPLETED e NO_SHOW também ocupam.
- Agendamento de **outro** barbeiro às 10:00 não afeta.
- TimeOff `10:00–11:00` → sem `10:00`…`10:30`.
- Domingo `2026-11-08` → `slots: []`; serviço inativo → `[]`; barbeiro inativo → `[]`.
- `barberId` de um CLIENT ou inexistente → 404; `serviceId` inexistente → 404; `date=03-11-2026` ou `2026-02-30` → 400; sem `barberId` → 400.

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): availability endpoint"`

---

### Task 10: Criar agendamento (com transação e lock)

**Files:**
- Create: `src/services/appointmentService.js`, `src/controllers/appointmentController.js`, `src/routes/appointments.routes.js`, `src/schemas/appointment.schemas.js`
- Modify: `src/repositories/appointmentRepository.js` (`create`, `findByIdWithRelations`, `findClientOverlap`), `src/repositories/userRepository.js` (`lockByIds(ids, transaction)`)
- Test: `tests/integration/appointments.create.test.js`

**Interfaces:**
- Consumes: `availabilityService.getSlotArgs`, `isSlotFree`, `appointmentJson`.
- Produces:
  - `userRepository.lockByIds(ids: number[], transaction)` — `SELECT ... FROM users WHERE id IN (...) ORDER BY id FOR UPDATE` (ordem por id evita deadlock entre barbeiro e cliente).
  - `appointmentService.create(actor: { id, role }, { serviceId, barberId, startsAt: Date, clientId? }) → Appointment` com relações.
- Fluxo de `create`:
  1. Resolver `clientId`: CLIENT → próprio id (se veio `clientId` ≠ próprio → 403); BARBER/ADMIN → `clientId` obrigatório (400 `VALIDATION_ERROR` com `details.clientId`) e precisa ser CLIENT ativo (404 "Cliente não encontrado"); BARBER com `barberId` ≠ próprio → 403.
  2. Barbeiro (BARBER ativo) e serviço (ativo) → senão 404.
  3. `sequelize.transaction(async t => { lockByIds([barberId, clientId], t); args = getSlotArgs({ ..., date: localDateOf(startsAt), transaction: t }); if (!isSlotFree(args, startsAt)) throw 409 SLOT_UNAVAILABLE "Este horário não está mais disponível"; if (findClientOverlap(...)) throw 409 CLIENT_SCHEDULE_CONFLICT "Você já tem um agendamento neste horário"; create({ ..., endsAt, priceCents: service.priceCents }) })`.
- Rota: `POST /appointments` (`authenticate`) → 201 Appointment. Schema: `serviceId`, `barberId`, `clientId?` inteiros positivos; `startsAt` `z.string().datetime({ offset: true })` → `Date`.

- [ ] **Step 1: Testes que falham** (`freezeNow(NOW)`, `setDefaultHours()`)
- Sem token → 401.
- CLIENT reserva `2026-11-03T10:00:00-03:00` → 201, corpo no formato 7.1: `status 'SCHEDULED'`, `startsAt '2026-11-03T10:00:00-03:00'`, `endsAt '2026-11-03T10:30:00-03:00'`, `priceCents 4500`, `paymentMethod/paidAt/canceledAt/cancelReason null`, `client { id, name, phone }`, `barber { id, name }`, `service { id, name, durationMinutes }`.
- `startsAt` em UTC `2026-11-03T13:00:00Z` → 201 e `startsAt` devolvido `'2026-11-03T10:00:00-03:00'`; `startsAt: '2026-11-03T10:00:00'` (sem offset) → 400 (Review Focus 4).
- Mesmo horário de novo (outro cliente) → 409 `SLOT_UNAVAILABLE`; `10:15` (sobrepõe) → 409; `10:30` → 201.
- Fora do expediente `08:00`, no almoço `12:00`, fora da grade `10:05`, domingo, menos de 30 min no futuro, mais de 60 dias → 409 `SLOT_UNAVAILABLE`.
- O mesmo CLIENT às `10:00` com outro barbeiro, já tendo `10:00` → 409 `CLIENT_SCHEDULE_CONFLICT`.
- Mudar o preço do serviço depois → agendamento mantém `priceCents` antigo.
- CLIENT com `clientId` de outro → 403; BARBER sem `clientId` → 400; BARBER para a própria agenda com `clientId` → 201; BARBER com `barberId` de outro barbeiro → 403; ADMIN com `clientId` de um BARBER → 404; serviço inativo → 404.
- **Concorrência (Review Focus 1):** `Promise.all` de dois POSTs de clientes diferentes, mesmo barbeiro e horário → status ordenados `[201, 409]`, e `Appointment.count()` = 1.

- [ ] **Step 2–4: falhar, implementar, passar.** Se a concorrência falhar de forma intermitente, rodar o teste 10× (`npx jest appointments.create -t "Concorr" --runInBand` em loop) antes de declarar resolvido.
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): transactional appointment booking"`

---

### Task 11: Listar, cancelar, concluir e marcar falta

**Files:**
- Modify: `src/services/appointmentService.js`, `src/controllers/appointmentController.js`, `src/routes/appointments.routes.js`, `src/schemas/appointment.schemas.js`, `src/repositories/appointmentRepository.js` (`list(filters)`)
- Test: `tests/integration/appointments.list.test.js`, `tests/integration/appointments.actions.test.js`

**Interfaces:**
- Produces:
  - `appointmentService.list(actor, { from?, to?, status?, barberId? }) → Appointment[]` — CLIENT: `clientId = actor.id`; BARBER: `barberId = actor.id` (ignora o filtro); ADMIN: filtro livre. `from` → `startsAt >= startOfLocalDay(from)`, `to` → `startsAt < endOfLocalDay(to)`. Ordem `startsAt ASC`.
  - `appointmentService.cancel(actor, id, { reason })`, `complete(actor, id, { paymentMethod })`, `noShow(actor, id)`.
  - Regra comum `loadForAction(actor, id, action)`: 404 se não existe; CLIENT só cancela o próprio (senão 403) e não pode `complete`/`noShow` (403 pelo `authorize`); BARBER só os da própria agenda (403); status ≠ SCHEDULED → 422 `INVALID_STATUS_TRANSITION`.
  - cancel: CLIENT com `startsAt - now < 2h` → 422 `CANCELLATION_WINDOW_CLOSED`; grava `status CANCELED`, `canceledAt now`, `cancelReason reason ?? null`.
  - complete/noShow: `now < startsAt` → 422 `APPOINTMENT_NOT_STARTED`; complete grava `status COMPLETED`, `paymentMethod`, `paidAt now`; noShow grava `NO_SHOW`.
- Rotas: `GET /appointments` (`authenticate`), `PATCH /appointments/:id/cancel` (`authenticate`), `PATCH /:id/complete` e `PATCH /:id/no-show` (`authenticate, authorize('BARBER','ADMIN')`). Todas devolvem o Appointment (200). Schemas: `reason?` string máx. 255; `paymentMethod` enum `CASH|PIX|CARD` obrigatório; query `status` enum, `from/to` data, `barberId` inteiro.

- [ ] **Step 1: Testes que falham**

`appointments.list.test.js` (dois clientes, dois barbeiros, agendamentos espalhados):
- sem token → 401.
- CLIENT A vê só os seus (nunca os de B); BARBER 1 vê só os da agenda dele, mesmo passando `barberId` do barbeiro 2; ADMIN vê todos e filtra por `barberId` e `status`.
- ordenação crescente por `startsAt`.
- Review Focus 2: agendamento às `2026-11-03T22:30-03:00` aparece em `from=2026-11-03&to=2026-11-03` e não em `from=2026-11-04` (requer `setDefaultHours` alterado ou inserção direta pelo factory — usar o factory).
- `status=FOO` → 400.

`appointments.actions.test.js`:
- cancel sem token → 401; CLIENT cancelando o de outro → 403; CLIENT cancelando o próprio com 3 h de antecedência → 200 `status CANCELED`, `canceledAt` preenchido, `cancelReason` igual ao enviado; com 1h59 → 422 `CANCELLATION_WINDOW_CLOSED`; BARBER cancela o da própria agenda a 10 min do início → 200; BARBER cancelando de outro barbeiro → 403; ADMIN cancela qualquer → 200; cancelar de novo → 422 `INVALID_STATUS_TRANSITION`; depois de cancelar, o horário volta em `GET /availability`.
- complete: CLIENT → 403; BARBER de outra agenda → 403; antes do início → 422 `APPOINTMENT_NOT_STARTED`; depois do início com `{ paymentMethod: 'PIX' }` → 200 `status COMPLETED`, `paymentMethod 'PIX'`, `paidAt` preenchido e `priceCents` inalterado; sem `paymentMethod` → 400; em CANCELED → 422 `INVALID_STATUS_TRANSITION`; `id` inexistente → 404.
- no-show: antes do início → 422; depois → 200 `status NO_SHOW`; em COMPLETED → 422.
- Review Focus 5: desativar o serviço (`DELETE /services/:id`) depois de reservar → o agendamento continua no `GET /appointments` com o mesmo `service` e pode ser concluído.

Para avançar o relógio dentro do teste use `freezeNow` de novo (o spy é substituído).

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): list, cancel, complete and no-show appointments"`

---

### Task 12: Bloqueios (TimeOff)

**Files:**
- Create: `src/services/timeOffService.js`, `src/controllers/timeOffController.js`, `src/routes/timeOff.routes.js`, `src/schemas/timeOff.schemas.js`
- Modify: `src/repositories/timeOffRepository.js` (`list`, `findById`, `create`, `destroy`), `src/serializers/index.js` (`timeOffJson`)
- Test: `tests/integration/timeOff.test.js`

**Interfaces:**
- Produces: `timeOffJson(t) → { id, barberId, startsAt, endsAt, reason }` (`reason` `null` se vazio); `timeOffService.list(actor, { barberId? })`, `create(actor, { barberId?, startsAt, endsAt, reason? })`, `remove(actor, id)`.
- Regras: BARBER cria só para si (se mandar `barberId` diferente → 403); ADMIN precisa mandar `barberId` de um BARBER (400 sem ele, 404 se não for barbeiro). `endsAt > startsAt` (400 com `details.endsAt`), ambos na grade de 15 min. Antes de criar, `appointmentRepository.findBusyForBarber` filtrado para `SCHEDULED` e `startsAt >= now` dentro de `[startsAt, endsAt)` → se houver, 409 `CONFLICTING_APPOINTMENTS` com `details`. DELETE: BARBER só os próprios (403), → 204.
- Rotas: `GET/POST /time-off`, `DELETE /time-off/:id` — todas `authenticate, authorize('BARBER','ADMIN')`.

- [ ] **Step 1: Testes que falham**
- sem token → 401 nas três; CLIENT → 403 nas três.
- BARBER cria → 201 no formato 7.1 com o próprio `barberId`; BARBER com `barberId` de outro → 403; GET do BARBER não traz bloqueios de outro barbeiro; DELETE de bloqueio de outro → 403; DELETE do próprio → 204; inexistente → 404.
- ADMIN cria com `barberId` → 201; sem `barberId` → 400; GET do ADMIN traz todos e filtra por `barberId`.
- `endsAt <= startsAt` → 400; `startsAt` sem offset → 400.
- Sobre agendamento SCHEDULED futuro → 409 `CONFLICTING_APPOINTMENTS` com o agendamento em `details`; sobre agendamento CANCELED → 201; bloqueio encostado (`10:30–11:00` depois de um `10:00–10:30`) → 201.
- Depois de criar o bloqueio, os horários somem de `GET /availability`.

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: Commit** — `git add backend/ && git commit -m "feat(backend): barber time off with conflict check"`

---

### Task 13: Seed, Swagger e README

**Files:**
- Create: `src/database/seed.js`, `src/docs/openapi.js`, `backend/README.md`
- Modify: `src/app.js` (monta `/docs` e `/docs.json`)
- Test: `tests/integration/seed.test.js`, `tests/integration/docs.test.js`

**Interfaces:**
- Produces: `seed({ adminEmail, adminPassword }) → Promise<void>` — idempotente (rodar duas vezes não duplica): cria o ADMIN se o e-mail não existe; cria as 7 BusinessHours se a tabela está vazia (seg–sex 09:00–19:00 com almoço 12:00–13:00, sáb 09:00–14:00 sem almoço, dom fechado); cria 3 serviços demo e 1 barbeiro demo se não houver serviços. Quando executado como script (`require.main === module`), lê `env`, sem `ADMIN_EMAIL`/`ADMIN_PASSWORD` sai com erro claro, e fecha a conexão.
- `openapi.js` exporta um objeto OpenAPI 3.0 com `servers: [{ url: '/api' }]`, `components.securitySchemes.bearerAuth`, schemas `User`, `Service`, `Barber`, `BusinessHours`, `TimeOff`, `Appointment`, `Error` (copiados da 7.1) e um path para cada rota da tabela da seção 7.

- [ ] **Step 1: Testes que falham**
- `seed.test.js`: `seed({ adminEmail: 'root@x.com', adminPassword: 'senha1234' })` duas vezes → 1 ADMIN, 7 BusinessHours, 3 serviços; depois `POST /api/auth/login` com essas credenciais → 200 e `user.role === 'ADMIN'`.
- `docs.test.js`: `GET /docs/` → 200 `text/html`; `GET /docs.json` → 200 com `openapi` começando por `'3.'` e `paths` contendo `/appointments/{id}/cancel`, `/availability`, `/auth/login`.

- [ ] **Step 2–4: falhar, implementar, passar.**
- [ ] **Step 5: README** — pré-requisitos (Postgres local, pgAdmin), `cp .env.example .env`, `npm run db:create`, `npm run db:migrate`, `npm run seed`, `npm run dev`, `npm test`; tabela de códigos de erro; exemplos `curl` de register, login, availability, criar e cancelar agendamento.
- [ ] **Step 6: Verificação manual no banco de dev** — `npm run db:create && npm run db:migrate && npm run seed && npm start`, depois `curl http://localhost:3333/api/services` → lista os 3 serviços; abrir `http://localhost:3333/docs`.
- [ ] **Step 7: Suite completa** — `npm test` → todos PASS.
- [ ] **Step 8: Commit** — `git add backend/ && git commit -m "feat(backend): seed, swagger docs and readme"`
