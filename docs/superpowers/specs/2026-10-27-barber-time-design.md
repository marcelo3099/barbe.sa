# Barber Time — Design

Data: 2026-10-27
Status: rascunho para aprovação

## 1. Intenção

Sistema web de agendamento para **uma única barbearia** ("Barber Time"). O cliente escolhe serviço, barbeiro, dia e horário livre; o barbeiro vê e conduz a própria agenda; o administrador cuida de barbeiros, serviços, horário de funcionamento e usuários.

É um projeto pessoal do autor. Os **requisitos técnicos e de segurança** foram tirados da página 3 do PDF `SA IOT.pdf` (SENAI/LAB365) e são obrigatórios aqui. As partes de restaurante desse PDF (mesas, cardápio, compra antecipada, 10% do garçom) **não** se aplicam.

O visual tem que ser **vintage e não parecer feito por IA**.

## 2. Objetivos

- Agendamento online que nunca deixa dois clientes com o mesmo barbeiro no mesmo horário.
- Três perfis com permissões separadas: **ADMIN**, **BARBER** (funcionário) e **CLIENT**.
- Atender todos os requisitos do PDF (seção 6).
- Código desenvolvido com **TDD**: o teste vem antes da implementação, no backend e no frontend.

## 3. Fora do escopo

- Várias barbearias (multi-tenant) e planos.
- Pagamento online (gateway, Pix integrado, cartão). O pagamento só é **registrado** (seção 5.5).
- Notificações por e-mail, SMS ou WhatsApp.
- Relatórios financeiros e dashboards.
- App mobile nativo.
- Login social e recuperação de senha por e-mail.

**Anti-objetivos**, ou seja, o projeto fracassa se acontecer:
- Visual genérico de "template de IA": degradês roxos, vidro fosco, fonte Inter em tudo, ilustrações 3D.
- Qualquer rota que deixe um perfil ver ou alterar dados de outro (por exemplo, um cliente vendo o agendamento de outro cliente).
- Senha guardada ou devolvida em texto puro em qualquer resposta.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| Express + Prisma + SQLite | zero instalação, TDD rápido | o usuário preferiu Sequelize |
| Express + Prisma + PostgreSQL no Docker | próximo de produção | exige Docker no Windows e deixa os testes lentos |
| Express + MongoDB/Mongoose | popular com Node | agendamento é relacional, e garantir que horários não se sobreponham é mais difícil |
| Express + Sequelize + SQLite | banco sem instalação, testes rápidos | o usuário prefere PostgreSQL e quer administrar pelo pgAdmin |
| **Express + Sequelize + PostgreSQL (escolhida)** | ORM e banco pedidos pelo usuário; o Postgres tem transações e locks de verdade, o que protege contra reservas duplicadas; o pgAdmin dá uma visão dos dados | exige o Postgres instalado localmente e um banco separado para os testes |

**Escolha do usuário:** Sequelize + PostgreSQL, administrado pelo pgAdmin.

## 5. Domínio

### 5.1 Entidades

- **User**: `id`, `name`, `email` (único), `phone` (opcional), `passwordHash`, `role` (`ADMIN` | `BARBER` | `CLIENT`), `active` (boolean), timestamps.
  - Um barbeiro é um User com `role = BARBER`. Não existe tabela separada de barbeiro.
- **Service**: `id`, `name`, `description`, `priceCents` (inteiro), `durationMinutes` (múltiplo de 15, entre 15 e 240), `active`.
- **BusinessHours**: `weekday` (0 a 6), `opensAt` ("HH:mm"), `closesAt` ("HH:mm"), `closed` (boolean). Uma linha por dia da semana.
- **TimeOff**: `id`, `barberId`, `startsAt`, `endsAt`, `reason`. Bloqueios de almoço, folga e férias.
- **Appointment**: `id`, `clientId`, `barberId`, `serviceId`, `startsAt`, `endsAt`, `priceCents` (cópia do preço no momento da reserva), `status`, `paymentMethod` (nulo ou `CASH` | `PIX` | `CARD`), `paidAt` (nulo), `canceledAt`, `cancelReason`, timestamps.

### 5.2 Status do agendamento

`SCHEDULED` → `COMPLETED` | `CANCELED` | `NO_SHOW`. Não há outras transições. Um agendamento finalizado não volta para `SCHEDULED`.

### 5.3 Regras de horário

- Fuso horário da barbearia: `America/Sao_Paulo`. O banco grava em UTC, e a API recebe e devolve no formato ISO 8601 com offset.
- As vagas seguem uma grade de **15 minutos**.
- Um horário de início **H** é livre para (barbeiro, serviço, data) quando todas as condições abaixo valem:
  1. a data não é passada, e H é pelo menos 30 minutos depois de agora;
  2. a barbearia está aberta no dia, e `[H, H + duração]` cabe dentro de `opensAt` e `closesAt`;
  3. não há sobreposição com nenhum Appointment do barbeiro em status `SCHEDULED` (os status `COMPLETED` e `NO_SHOW` também ocupam o horário);
  4. não há sobreposição com nenhum TimeOff do barbeiro;
  5. o barbeiro está ativo e o serviço está ativo;
  6. a data é no máximo 60 dias à frente.
- Sobreposição usa intervalo semiaberto: `a.start < b.end && b.start < a.end`. Um serviço que termina às 10:00 permite outro que começa às 10:00.
- **Criar um agendamento revalida as regras dentro de uma transação.** Se outro cliente pegou o horário entre a consulta e a reserva, a API responde `409 SLOT_UNAVAILABLE`.
- Um cliente não pode ter dois agendamentos `SCHEDULED` que se sobreponham, mesmo com barbeiros diferentes.

### 5.4 Cancelamento

- **CLIENT** cancela só os próprios agendamentos e só até **2 horas antes** do início. Depois disso, a API responde `422 CANCELLATION_WINDOW_CLOSED`.
- **BARBER** cancela os agendamentos da própria agenda a qualquer momento.
- **ADMIN** cancela qualquer agendamento a qualquer momento.
- Cancelar libera o horário.

### 5.4.1 Quem cria agendamento

- **CLIENT** cria para si mesmo, sem enviar `clientId`.
- **BARBER** e **ADMIN** podem criar para um cliente já cadastrado, enviando `clientId`. O BARBER só cria na própria agenda (`barberId` igual ao dele). Esse caminho atende quem liga ou aparece na hora; a pessoa precisa ter uma conta de cliente, que o ADMIN pode criar.
- As mesmas regras da seção 5.3 valem para todos os perfis.

### 5.4.2 Quando a disponibilidade diminui com agendamentos já marcados

Regra única: **a API recusa** a mudança que deixaria agendamentos `SCHEDULED` futuros em conflito. A resposta é `409 CONFLICTING_APPOINTMENTS`, com a lista dos agendamentos afetados em `details`. Quem fez a mudança cancela ou remaneja esses agendamentos e tenta de novo. Nada é cancelado automaticamente. A regra vale para:
- criar um TimeOff sobre agendamentos;
- alterar BusinessHours (horário menor, `closed`, novo intervalo) que deixe agendamentos fora;
- desativar um barbeiro que tenha agendamentos futuros.

Desativar um **serviço** não afeta os agendamentos já feitos: eles continuam válidos, e o serviço só deixa de aparecer para novas reservas.

### 5.4.3 Intervalo de almoço

BusinessHours ganha os campos opcionais `breakStartsAt` e `breakEndsAt` ("HH:mm"), que valem para a barbearia inteira naquele dia da semana. Na seção 5.3, regra 2, o serviço precisa caber no expediente **sem tocar no intervalo**. Pausas individuais de um barbeiro continuam sendo TimeOff.

### 5.4.4 Concluir e marcar falta

`complete` e `no-show` só são aceitos **depois de `startsAt`**. Antes disso, a API responde `422 APPOINTMENT_NOT_STARTED`. Só valem para agendamentos `SCHEDULED`; em qualquer outro status, `422 INVALID_STATUS_TRANSITION`.

### 5.5 Pagamento (apenas registro)

- BARBER (só nos agendamentos dele) ou ADMIN marca o atendimento como `COMPLETED` informando o `paymentMethod`. Nesse momento o sistema preenche `paidAt`.
- Não existe cobrança online. O valor registrado é o `priceCents` copiado na hora da reserva.

## 6. Requisitos de segurança e técnicos (do PDF)

| Requisito | Como será atendido |
|---|---|
| **RBAC** com Administrador, Funcionário e Cliente | Campo `role` no User. Middleware `authorize(...roles)` por rota. Nos serviços, a checagem de **posse** (cliente só vê o que é dele, barbeiro só a própria agenda) é testada em cada caso. |
| **JWT** com expiração | `jsonwebtoken`, payload `{ sub, role }`, expiração de **2 horas** (`JWT_EXPIRES_IN`), segredo em `JWT_SECRET`. O middleware `authenticate` lê `Authorization: Bearer`. Token expirado ou inválido gera `401`. Não há refresh token: ao expirar, o usuário faz login de novo. |
| **Bcrypt** | `bcrypt` com custo 10 (em teste, custo 4 para acelerar). O `passwordHash` nunca sai do repositório: os serializers excluem o campo. |
| **Zod** | Um schema por rota que recebe dados (body, params, query). O middleware `validate(schema)` responde `400 VALIDATION_ERROR` com detalhes por campo. |
| **CORS** | Pacote `cors` com allowlist em `CORS_ORIGIN` (separada por vírgula). Origem fora da lista é recusada. |
| **Erros padronizados** | Classe `AppError(status, code, message, details?)` e um middleware final. Todas as respostas de erro têm o formato `{ "error": { "code": "...", "message": "...", "details": ... } }`. Erros inesperados viram `500 INTERNAL_ERROR` sem stack trace na resposta. |
| **Camadas** | `routes → controllers → services → repositories → models (Sequelize)`. O controller não fala com o model, e o service não conhece `req`/`res`. |
| **Git/GitHub** | Repositório git desde o início, commits pequenos por tarefa. Fica a cargo do usuário criar o remoto no GitHub e fazer o push. |
| **Documentação da API** | Swagger (OpenAPI 3) servido em `/docs` com `swagger-ui-express`, e um `README` com exemplos de `curl`. |

**Cadastro:** a rota pública `POST /auth/register` cria **somente CLIENT**. Usuários BARBER e ADMIN só são criados por um ADMIN. O primeiro ADMIN vem de um seed que lê `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`.

**Edição de usuários pelo ADMIN (`PATCH /users/:id`):** pode alterar `name`, `phone`, `role`, `active` e definir uma nova senha (que passa pelo bcrypt). O ADMIN não pode desativar a si mesmo nem rebaixar o próprio perfil; nos dois casos, a resposta é `422 CANNOT_MODIFY_SELF`. Assim sempre resta pelo menos um ADMIN ativo. Um BARBER não agenda como cliente: cada conta tem um único perfil.

**Lista do PDF:** a tabela acima é a lista **completa** da página 3 do `SA IOT.pdf` (conferida). Não há exigência de rate limiting, helmet, logs, meta de cobertura ou deploy.

**Mensagens de login:** e-mail inexistente e senha errada dão a mesma resposta, `401 INVALID_CREDENTIALS`. Usuário inativo não consegue fazer login.

## 7. API (resumo)

Prefixo `/api`. A coluna "Quem" indica o perfil exigido; "público" dispensa token.

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| POST | /auth/register | público | cria CLIENT |
| POST | /auth/login | público | devolve `{ token, user }` |
| GET | /auth/me | logado | dados do usuário |
| GET | /services | público | serviços ativos |
| POST/PATCH/DELETE | /services[/:id] | ADMIN | CRUD (o DELETE desativa) |
| GET | /barbers | público | barbeiros ativos (id e nome) |
| GET | /availability?barberId&serviceId&date | público | horários livres do dia |
| GET/PUT | /business-hours | GET público, PUT ADMIN | horário de funcionamento |
| GET/POST/DELETE | /time-off[/:id] | BARBER (os próprios), ADMIN | bloqueios |
| POST | /appointments | CLIENT (para si); BARBER e ADMIN (com `clientId`) | cria agendamento (seção 5.4.1) |
| GET | /appointments | logado | CLIENT vê os seus, BARBER vê os da agenda dele, ADMIN vê todos; filtros `from`, `to`, `status`, `barberId` |
| PATCH | /appointments/:id/cancel | regras da seção 5.4 | cancela |
| PATCH | /appointments/:id/complete | BARBER (dono da agenda), ADMIN | conclui e registra o pagamento |
| PATCH | /appointments/:id/no-show | BARBER (dono da agenda), ADMIN | marca falta |
| GET/POST/PATCH | /users[/:id] | ADMIN | lista, cria (qualquer perfil), edita e ativa/desativa |

### 7.1 Contrato JSON (front e back seguem exatamente isto)

As chaves vêm em camelCase. Datas e horas seguem ISO 8601 com offset (`2026-11-03T10:30:00-03:00`); datas puras, `YYYY-MM-DD`; horas do dia, `HH:mm`. Valores em dinheiro são inteiros em centavos. Respostas de sucesso trazem o objeto ou a lista **direto**, sem envelope `data`.

```jsonc
// User (nunca contém senha nem hash)
{ "id": 1, "name": "Ana", "email": "ana@x.com", "phone": "48999990000", "role": "CLIENT", "active": true }

// POST /auth/register  body: { name, email, password (mín. 8), phone? }  → 201 User
// POST /auth/login     body: { email, password }                        → 200 { "token": "...", "user": User }
// GET  /auth/me                                                          → 200 User

// Service
{ "id": 1, "name": "Corte clássico", "description": "...", "priceCents": 4500, "durationMinutes": 30, "active": true }

// Barber (GET /barbers)
{ "id": 2, "name": "Seu Jorge" }

// GET /availability?barberId=2&serviceId=1&date=2026-11-03
{ "date": "2026-11-03", "slots": ["2026-11-03T09:00:00-03:00", "2026-11-03T09:15:00-03:00"] }

// BusinessHours (GET devolve as 7, PUT recebe as 7)
[{ "weekday": 2, "opensAt": "09:00", "closesAt": "20:00", "breakStartsAt": "12:00", "breakEndsAt": "13:00", "closed": false }]

// TimeOff   POST body: { barberId? (só ADMIN), startsAt, endsAt, reason? }
{ "id": 1, "barberId": 2, "startsAt": "...", "endsAt": "...", "reason": "Dentista" }

// Appointment  POST body: { serviceId, barberId, startsAt, clientId? }
{
  "id": 10, "status": "SCHEDULED", "startsAt": "...", "endsAt": "...", "priceCents": 4500,
  "paymentMethod": null, "paidAt": null, "canceledAt": null, "cancelReason": null,
  "client":  { "id": 5, "name": "Ana", "phone": "48999990000" },
  "barber":  { "id": 2, "name": "Seu Jorge" },
  "service": { "id": 1, "name": "Corte clássico", "durationMinutes": 30 }
}
// PATCH /appointments/:id/cancel    body: { reason? }
// PATCH /appointments/:id/complete  body: { paymentMethod: "CASH" | "PIX" | "CARD" }
// PATCH /appointments/:id/no-show   body: {}
// GET /appointments → lista de Appointment ordenada por startsAt (crescente)

// Erro (todas as rotas)
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos", "details": { "email": ["E-mail inválido"] } } }
```

Mensagens de erro (`message`) são escritas em português, prontas para aparecer na tela.

Códigos HTTP: `400` validação, `401` sem token ou token inválido, `403` perfil sem permissão ou recurso de outra pessoa, `404` não encontrado, `409` conflito (e-mail já usado, horário ocupado), `422` regra de negócio violada.

## 8. Frontend

React + Vite + React Router. As chamadas usam `fetch` através de um cliente único que injeta o token e converte o formato de erro da seção 6 em mensagens na tela.

- **Token:** fica no `localStorage`. Quando a API responde `401`, o front limpa o token e manda para o login. Escolha minha, pela simplicidade; a alternativa mais segura é um cookie httpOnly.
- **Rotas protegidas por perfil:** a checagem no front existe só para a navegação. Quem garante a segurança é a API.

Páginas:
- **Público:** Home (hero e serviços, conforme a maquete), Login e Cadastro.
- **Cliente:** Agendar (fluxo serviço → barbeiro → data → horário → confirmar) e Meus agendamentos (com botão de cancelar).
- **Barbeiro:** Minha agenda (por dia, com ações de concluir com forma de pagamento, falta e cancelar) e Bloqueios.
- **Admin:** Agenda geral, Serviços, Barbeiros/Usuários e Horário de funcionamento.

### 8.1 Identidade visual, definida nas maquetes

Direção "**Couro & Whisky**", com a hero em foto de fundo inteira (maquete aprovada: `.superpowers/brainstorm/.../content/hero-v2.html`).

- **Cores:** fundo `#2A1E17`, fundo secundário `#1F160F`, couro `#6B3E26`, latão `#B08D57`, creme `#E9DCC4`, texto suave `#C9B48F`, linhas `rgba(176,141,87,.35)`.
- **Fontes:** *DM Serif Display* para títulos, logo e botões; *Cormorant Garamond* para o texto. Ambas do Google Fonts.
- **Elementos:** botões retos (sem cantos arredondados) com borda de latão; textos em caixa alta espaçada; listas de preço com linha pontilhada, como em cardápio; molduras de quadro nas fotos; ruído leve de papel no fundo; fotos com sépia leve.
- **Fotos:** Unsplash (cadeira de couro na hero, cadeira vermelha antiga na seção de serviços). Podem ser trocadas depois por fotos reais da barbearia.
- Telas internas (agenda, tabelas, formulários) seguem a mesma paleta com fundo escuro.

## 9. Estrutura e testes

```
Barber_Time/
  backend/   src/{config,models,repositories,services,controllers,routes,middlewares,schemas,errors,docs}  tests/
  frontend/  src/{api,auth,components,pages,styles}  (testes junto aos componentes)
  docs/
```

- **Backend:** Jest + Supertest, rodando em série (`--runInBand`). Testes de unidade nos services (regras de horário, cancelamento e RBAC por posse) e testes de integração por rota, num banco PostgreSQL de teste separado (`barber_time_test`) que é limpo antes de cada arquivo de teste. Os testes de RBAC cobrem, em toda rota protegida, os casos "sem token", "perfil errado" e "recurso de outra pessoa".
- **Frontend:** Vitest + Testing Library, com MSW para simular a API. O front é desenvolvido em paralelo ao back, a partir do contrato da seção 7.
- **Variáveis de ambiente:** `.env.example` com `PORT` (padrão 3333), `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN` (padrão `http://localhost:5173`), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (`barber_time`), `DB_NAME_TEST` (`barber_time_test`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. O `.env` não é versionado. O frontend usa `VITE_API_URL` (padrão `http://localhost:3333/api`).
- **Banco:** PostgreSQL local, administrado pelo pgAdmin. As tabelas são criadas com migrations do Sequelize (`sequelize-cli`), e não com `sync()` no banco de desenvolvimento. Nos testes, `sync({ force: true })` no banco de teste. A criação do agendamento usa uma transação com `SELECT ... FOR UPDATE` nas linhas do barbeiro (ou um lock equivalente) para impedir reserva duplicada quando dois pedidos chegam ao mesmo tempo.

## 10. Decisões do usuário

- Barbearia única, projeto pessoal, com os requisitos de segurança do PDF.
- Stack: Node + Express, React, **Sequelize + PostgreSQL (pgAdmin)**.
- Divisão do trabalho: o backend é feito em outra sessão do Claude Code (com desenvolvimento orientado a subagentes) e o frontend nesta sessão, em paralelo.
- Visual: direção B "Couro & Whisky", hero com foto de fundo inteira de barbearias antigas.
- Escopo: apenas o que o PDF exige; nada além.
- Processo: TDD e desenvolvimento orientado a subagentes.

## 11. Decisões minhas (revisar)

- Postgres instalado localmente (não Docker), com um banco separado para testes.
- Pagamento só registrado no balcão (dinheiro, Pix ou cartão).
- JWT de 2 horas sem refresh, token no `localStorage`.
- Grade de 15 minutos, antecedência mínima de 30 minutos, reserva até 60 dias à frente e cancelamento pelo cliente até 2 horas antes.
- `fetch` em vez de axios; Swagger para a documentação.
- Mudanças que diminuem a disponibilidade são recusadas com `409` quando há agendamentos em conflito (seção 5.4.2).
- Intervalo de almoço fixo da barbearia definido em BusinessHours (seção 5.4.3).
- BARBER e ADMIN podem agendar por um cliente já cadastrado (seção 5.4.1).
- Concluir e marcar falta só depois do horário de início (seção 5.4.4).
- O ADMIN não pode desativar nem rebaixar a si mesmo.

## 12. Deixado para quem for construir

- Nomes de arquivos, componentes e mensagens de erro.
- Layout exato das telas internas, dentro da identidade da seção 8.1.
- Dados do seed de demonstração (serviços, barbeiros e horários de exemplo).
