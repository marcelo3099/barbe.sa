# Barber Time Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o frontend React do Barber Time (site público, área do cliente, do barbeiro e do admin), consumindo a API descrita no contrato da seção 7.1 do spec.

**Architecture:** SPA em React + Vite, com React Router e um único cliente HTTP (`apiFetch`) que injeta o JWT e converte erros no formato padrão. A autenticação fica num `AuthProvider` com o token no `localStorage`. As páginas são organizadas por perfil. Todo acesso à API nos testes é simulado com MSW, o que permite desenvolver em paralelo ao backend.

**Tech Stack:** React 18, Vite 5, React Router 6, Vitest, @testing-library/react, @testing-library/user-event, MSW 2, jsdom. CSS puro com variáveis (sem framework de UI).

**Spec:** `docs/superpowers/specs/2026-10-27-barber-time-design.md` (seções 5, 7, 7.1 e 8). Maquete de referência visual: `.superpowers/brainstorm/833-1793143940/content/hero-v2.html` (local, não versionada; os valores necessários estão copiados abaixo).

## Global Constraints

- Trabalhar **só em `frontend/`** (e neste plano). Commits com `git add frontend/ ...`, nunca `git add -A`, porque o backend é commitado em paralelo por outra sessão.
- Base da API: `import.meta.env.VITE_API_URL ?? "http://localhost:3333/api"`. O dev server roda na porta 5173.
- O contrato JSON é exatamente o da seção 7.1 do spec: camelCase, sem envelope `data`, dinheiro em `priceCents`, erros no formato `{ error: { code, message, details } }`.
- Token no `localStorage`, chave `bt_token`. Header `Authorization: Bearer <token>`.
- Todo horário é exibido no fuso `America/Sao_Paulo` (`Intl.DateTimeFormat` com `timeZone`), qualquer que seja o fuso do navegador.
- Todo texto da interface é em português do Brasil. A mensagem de erro exibida é o `error.message` vindo da API.
- **Cores**, como variáveis CSS em `:root`: `--bg:#2A1E17; --bg2:#1F160F; --leather:#6B3E26; --brass:#B08D57; --cream:#E9DCC4; --muted:#C9B48F; --line:rgba(176,141,87,.35)`.
- **Fontes** (Google Fonts): títulos, logo e botões em `'DM Serif Display'`; texto em `'Cormorant Garamond'` (pesos 500, 600 e 700).
- **Estilo:** botões sem cantos arredondados (`border-radius:0`), com borda de latão e texto em caixa alta espaçada; listas de preço com linha pontilhada; fotos com `filter: sepia(.35) contrast(1.05)`; ruído leve de papel no fundo. **Proibido:** degradês roxos, glassmorphism, fonte Inter e sombras coloridas.
- **Fotos da hero e dos serviços:** `https://images.unsplash.com/photo-1512690459411-b9245aed614b?w=2000&q=75&auto=format&fm=jpg` (hero) e `https://images.unsplash.com/photo-1629881544138-c45fc917eb81?w=900&q=75&auto=format&fm=jpg` (moldura).
- **Rotas do front:** `/`, `/entrar`, `/cadastro`, `/agendar`, `/meus-agendamentos`, `/agenda`, `/bloqueios`, `/admin/agenda`, `/admin/servicos`, `/admin/usuarios`, `/admin/horarios`.
- **Destino após o login, por perfil:** CLIENT → `/agendar`; BARBER → `/agenda`; ADMIN → `/admin/agenda`.

## Review Focus

1. **Token expira no meio do uso:** qualquer `401` desloga, redireciona para `/entrar` e mostra "Sua sessão expirou. Entre novamente." (Task 2 e Task 3).
2. **Horário ocupado entre ver e confirmar:** um `409 SLOT_UNAVAILABLE` mostra a mensagem, recarrega os horários e volta para a escolha de horário, sem perder serviço, barbeiro e data (Task 6).
3. **Navegador em outro fuso:** o slot `2026-11-03T09:00:00-03:00` aparece como "09:00" mesmo com `TZ=UTC` (Task 1, no ambiente de testes, e Task 6).
4. **Clique duplo em botões que alteram dados:** confirmar, cancelar e concluir ficam desabilitados enquanto o pedido está em andamento (Tasks 6, 7 e 8).
5. **API fora do ar:** quando o `fetch` lança um erro, a tela mostra "Não foi possível conectar ao servidor." em vez de quebrar (Task 2).

---

## File Structure

```
frontend/
  index.html                     fontes Google, <div id="root">
  vite.config.js                 react plugin + bloco test (jsdom, setupFiles)
  package.json
  .env.example                   VITE_API_URL=http://localhost:3333/api
  src/
    main.jsx                     createRoot + BrowserRouter + AuthProvider + App
    App.jsx                      tabela de rotas
    styles/theme.css             tokens, reset, tipografia, .btn, .field, .card, .table
    lib/datetime.js              formatação no fuso de São Paulo
    lib/money.js                 formatPrice
    api/client.js                apiFetch, ApiError, setUnauthorizedHandler
    api/endpoints.js             funções finas por rota (auth, services, ...)
    auth/AuthContext.jsx         AuthProvider, useAuth
    auth/RequireRole.jsx         guarda de rota por perfil
    components/Layout.jsx        nav + <Outlet/>; links por perfil
    components/ErrorMessage.jsx  mostra ApiError.message e details por campo
    components/AppointmentCard.jsx
    pages/Home.jsx
    pages/Login.jsx  pages/Register.jsx
    pages/client/Booking.jsx  pages/client/MyAppointments.jsx
    pages/barber/Agenda.jsx   pages/barber/TimeOff.jsx
    pages/admin/AdminAgenda.jsx  pages/admin/Services.jsx  pages/admin/Users.jsx  pages/admin/BusinessHours.jsx
    test/setup.js                jest-dom, MSW server listen/reset/close, localStorage.clear
    test/server.js               setupServer(...handlers)
    test/handlers.js             handlers padrão + fixtures
    test/fixtures.js             user/service/barber/appointment de exemplo (formato 7.1)
    test/renderWithProviders.jsx render com MemoryRouter + AuthProvider
```

Os testes ficam ao lado de cada arquivo (`X.test.jsx`).

---

### Task 1: Scaffold, tema e utilitários de data e dinheiro

**Files:**
- Create: `frontend/` (Vite React JS), `vite.config.js`, `index.html`, `.env.example`, `src/main.jsx`, `src/App.jsx`, `src/styles/theme.css`, `src/lib/datetime.js`, `src/lib/money.js`, `src/test/setup.js`, `src/test/server.js`, `src/test/handlers.js`, `src/test/fixtures.js`
- Test: `src/lib/datetime.test.js`, `src/lib/money.test.js`, `src/App.test.jsx`

**Interfaces:**
- Produces:
  - `formatPrice(cents: number): string` → `"R$ 45,00"` (via `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`; normalizar o espaço especial para espaço comum).
  - `formatTime(iso: string): string` → `"09:00"`, sempre no fuso de São Paulo.
  - `formatDate(iso: string): string` → `"ter., 03/11"` (weekday short + dd/MM, pt-BR, fuso de São Paulo).
  - `todayISODate(now?: Date): string` → `"YYYY-MM-DD"` no fuso de São Paulo.
  - `dayRange(date: "YYYY-MM-DD"): { from: string, to: string }` → `from = date+"T00:00:00-03:00"`, `to = date+"T23:59:59-03:00"`.
  - Fixtures: `clientUser`, `barberUser`, `adminUser`, `services`, `barbers`, `appointment(overrides)`, todos no formato 7.1.
  - `server` (MSW) exportado de `src/test/server.js`.

- [ ] **Step 1:** Criar o projeto com `npm create vite@latest frontend -- --template react` e instalar `react-router-dom`, além de, como dev, `vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw`. No `package.json`, o script de teste fica `"test": "cross-env TZ=UTC vitest"` (instalar `cross-env`), para que os testes rodem num fuso diferente do de São Paulo.
- [ ] **Step 2: Escrever os testes que falham**

```js
// money.test.js
expect(formatPrice(4500)).toBe("R$ 45,00");
expect(formatPrice(0)).toBe("R$ 0,00");
// datetime.test.js
expect(formatTime("2026-11-03T09:00:00-03:00")).toBe("09:00");
expect(formatTime("2026-11-03T12:00:00Z")).toBe("09:00");
expect(todayISODate(new Date("2026-11-04T02:00:00Z"))).toBe("2026-11-03"); // ainda é dia 3 em SP
expect(dayRange("2026-11-03")).toEqual({ from: "2026-11-03T00:00:00-03:00", to: "2026-11-03T23:59:59-03:00" });
// App.test.jsx
// renderiza <App/> em "/" e encontra o link com o texto "Barber Time"
```

- [ ] **Step 3:** Rodar `npm test -- --run`. Esperado: FAIL (módulos inexistentes).
- [ ] **Step 4:** Implementar `money.js`, `datetime.js`, o `theme.css` (tokens das Global Constraints, `body{background:var(--bg);color:var(--cream);font-family:'Cormorant Garamond'}`, `.btn`, `.btn.solid`, `.field`, `.table`, `.kicker`), o `index.html` com o link das fontes, o `setup.js` com MSW e um `App` mínimo com a nav e o logo "Barber Time".
- [ ] **Step 5:** Rodar `npm test -- --run`. Esperado: PASS.
- [ ] **Step 6:** Commit com `git add frontend/` e a mensagem `feat(front): scaffold vite app, theme tokens and date/money utils`.

---

### Task 2: Cliente HTTP

**Files:**
- Create: `src/api/client.js`, `src/api/endpoints.js`
- Test: `src/api/client.test.js`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code: string; details?: object }`
  - `apiFetch(path: string, { method="GET", body, query } = {}): Promise<any>`: monta `BASE + path` e a query string (ignorando valores `undefined`), envia JSON e o header Bearer quando há `localStorage.bt_token`, e devolve o JSON (ou `null` no `204`).
  - `setUnauthorizedHandler(fn: () => void)`: chamada em toda resposta `401` **que não seja** do `POST /auth/login`.
  - `endpoints.js` exporta: `auth.{register, login, me}`, `services.{list, create, update, remove}`, `barbers.list`, `availability.get({barberId, serviceId, date})`, `businessHours.{get, put}`, `timeOff.{list, create, remove}`, `appointments.{list(filters), create, cancel(id, reason), complete(id, paymentMethod), noShow(id)}`, `users.{list, create, update}`. Cada função é uma linha sobre `apiFetch`, com caminhos e métodos exatamente como na seção 7 do spec.

- [ ] **Step 1: Escrever os testes que falham**, usando o MSW em `client.test.js`:
  - `sends bearer token when present`: com `localStorage.bt_token="abc"`, o handler recebe `authorization === "Bearer abc"`.
  - `returns parsed json`: `GET /services` → retorna o array das fixtures.
  - `throws ApiError with code, message and details`: um handler devolvendo `400 {error:{code:"VALIDATION_ERROR",message:"Dados inválidos",details:{email:["E-mail inválido"]}}}` → rejeita com `status 400`, `code "VALIDATION_ERROR"`, `message "Dados inválidos"` e `details.email[0] "E-mail inválido"`.
  - `calls unauthorized handler on 401`: `GET /auth/me` com 401 → o handler é chamado uma vez.
  - `does not call unauthorized handler on login 401`: `POST /auth/login` com 401 → o handler não é chamado, e a ApiError tem `code "INVALID_CREDENTIALS"`.
  - `network failure becomes friendly ApiError`: `http.get(..., () => HttpResponse.error())` → `status 0`, `code "NETWORK_ERROR"`, `message "Não foi possível conectar ao servidor."`.
  - `non-json 500 becomes INTERNAL_ERROR`: corpo vazio com 500 → `code "INTERNAL_ERROR"`, `message "Erro inesperado. Tente novamente."`.
- [ ] **Step 2:** Rodar `npm test -- --run src/api`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `client.js` e `endpoints.js`.
- [ ] **Step 4:** Rodar `npm test -- --run src/api`. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): api client with standardized errors`.

---

### Task 3: Autenticação, guarda de rota e layout

**Files:**
- Create: `src/auth/AuthContext.jsx`, `src/auth/RequireRole.jsx`, `src/components/Layout.jsx`, `src/components/ErrorMessage.jsx`, `src/test/renderWithProviders.jsx`; Modify: `src/App.jsx`, `src/main.jsx`
- Test: `src/auth/AuthContext.test.jsx`, `src/auth/RequireRole.test.jsx`, `src/components/Layout.test.jsx`

**Interfaces:**
- Consumes: `apiFetch`, `setUnauthorizedHandler` e `endpoints.auth` (Task 2).
- Produces:
  - `useAuth(): { user: User|null, loading: boolean, login(email, password): Promise<User>, register(data): Promise<User>, logout(reason?: "expired"): void, sessionMessage: string|null }`
  - `register` cria a conta e em seguida faz o login automaticamente.
  - `logout("expired")` grava `sessionMessage = "Sua sessão expirou. Entre novamente."`, e a tela `/entrar` exibe essa mensagem.
  - `<RequireRole roles={["CLIENT"]}>`: com `loading`, mostra "Carregando..."; sem usuário, `<Navigate to="/entrar" />`; com perfil errado, `<Navigate to={homeFor(user.role)} />`.
  - `homeFor(role): string`: o mapa de destino das Global Constraints.
  - `<ErrorMessage error={ApiError|null} />`: mostra `role="alert"` com `error.message`.
  - `renderWithProviders(ui, { route="/", user=null })`: quando `user` é passado, grava o token `"test-token"` e o handler de `/auth/me` devolve esse usuário.
  - O Layout mostra links diferentes por perfil. Visitante: Serviços, Entrar. CLIENT: Agendar, Meus agendamentos, Sair. BARBER: Agenda, Bloqueios, Sair. ADMIN: Agenda, Serviços, Usuários, Horários, Sair.

- [ ] **Step 1: Escrever os testes que falham:**
  - `restores session from stored token`: com o token salvo e `/auth/me` devolvendo `clientUser` → `user.name === "Ana"` depois do loading.
  - `login stores token and returns user`: depois de `login()`, `localStorage.bt_token === "jwt-1"`.
  - `expired token logs out with message`: `/auth/me` devolve 401 → o token é removido e `sessionMessage` vira `"Sua sessão expirou. Entre novamente."`.
  - `RequireRole redirects anonymous to /entrar` e `RequireRole redirects BARBER away from /agendar to /agenda`.
  - `Layout shows client links`: com `clientUser`, aparecem os links "Agendar" e "Meus agendamentos", e o link "Usuários" não aparece.
- [ ] **Step 2:** Rodar `npm test -- --run src/auth src/components`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. O `AuthProvider` registra o `setUnauthorizedHandler(() => logout("expired"))` e, depois do logout, navega para `/entrar`. O `App` monta todas as rotas das Global Constraints, envolvidas por `RequireRole`, e as páginas ainda não implementadas ficam como componentes vazios com um `<h1>`.
- [ ] **Step 4:** Rodar os testes. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): auth context, role guard and layout`.

---

### Task 4: Home (hero e serviços)

**Files:**
- Create: `src/pages/Home.jsx`, `src/pages/Home.css`
- Test: `src/pages/Home.test.jsx`

**Interfaces:**
- Consumes: `endpoints.services.list`, `formatPrice`, `useAuth`, `homeFor`.

Reproduz a maquete aprovada: hero de altura `92vh` com a foto à direita (largura de 72%), um escurecimento `linear-gradient(90deg, var(--bg) 0%, var(--bg) 30%, rgba(42,30,23,.75) 48%, rgba(42,30,23,.15) 80%)`, kicker "Est. 1957", `h1` "A cadeira está *à sua espera.*" (com o `em` em latão), o texto "Corte na tesoura, barba na navalha e toalha quente. Escolha o barbeiro e o horário em menos de um minuto.", e os botões "Reservar cadeira" (sólido) e "Ver serviços". Depois vem uma faixa com três colunas ("Ter a Sáb · 9h às 20h", "4 barbeiros · de mão firme", "Rua das Flores, 123 · Centro"), e por fim a seção "Serviços": a lista com linha pontilhada à esquerda e a foto emoldurada à direita. Abaixo de 820px, vira uma coluna só.

- [ ] **Step 1: Escrever os testes que falham:**
  - `lists active services with prices`: aparecem "Corte clássico" e "R$ 45,00", vindos das fixtures.
  - `reserve button goes to /entrar when anonymous`: clicar em "Reservar cadeira" leva para a rota `/entrar`.
  - `reserve button goes to /agendar for client`.
  - `shows error when services fail`: um 500 em `/services` mostra um `role="alert"`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): home page with vintage hero`.

---

### Task 5: Login e cadastro

**Files:**
- Create: `src/pages/Login.jsx`, `src/pages/Register.jsx`, `src/pages/Auth.css`
- Test: `src/pages/Login.test.jsx`, `src/pages/Register.test.jsx`

**Interfaces:**
- Consumes: `useAuth().login/register/sessionMessage`, `homeFor`, `ErrorMessage`.

Os formulários ficam centralizados numa "ficha" com borda dupla de latão. Labels: "E-mail" e "Senha"; no cadastro, também "Nome" e "Telefone (opcional)". Os botões são "Entrar" e "Criar conta".

- [ ] **Step 1: Escrever os testes que falham:**
  - `login redirects BARBER to /agenda`.
  - `login shows INVALID_CREDENTIALS message`: um 401 com `message "E-mail ou senha inválidos"` faz o texto aparecer.
  - `login shows session expired message`: com `sessionMessage` preenchido, o texto "Sua sessão expirou. Entre novamente." aparece.
  - `register shows field errors from details`: um 400 com `details.email=["E-mail já cadastrado"]` faz o texto aparecer ligado ao campo E-mail (`aria-describedby`).
  - `register blocks short password client-side`: com uma senha de 7 caracteres aparece "A senha precisa ter pelo menos 8 caracteres", e nenhum pedido é feito.
  - `submit button disabled while pending`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): login and register pages`.

---

### Task 6: Fluxo de agendamento (cliente, barbeiro e admin)

**Files:**
- Create: `src/pages/client/Booking.jsx`, `src/pages/client/Booking.css`
- Test: `src/pages/client/Booking.test.jsx`

**Interfaces:**
- Consumes: `endpoints.services.list`, `barbers.list`, `availability.get`, `appointments.create`, `users.list` (só para ADMIN), `formatTime`, `formatPrice`, `todayISODate`, `useAuth`.
- Produces: `<Booking forStaff?: boolean />`, também usada em `/admin/agenda` (Task 10) e na agenda do barbeiro (Task 13).

O fluxo tem 5 passos visíveis numa só página, cada um liberado quando o anterior é escolhido: **1 Serviço** (cartões com nome, duração e preço) → **2 Barbeiro** → **3 Data** (`<input type="date">` com `min = todayISODate()` e `max = hoje + 60 dias`) → **4 Horário** (botões com `formatTime(slot)`; sem horários livres, o texto "Nenhum horário livre neste dia.") → **5 Confirmar** (resumo e botão "Confirmar agendamento").

Com `forStaff`: aparece antes o passo **0 Cliente**, um `<select>` com os usuários de `users.list` filtrados por `role === "CLIENT"`. Esse `<select>` só existe para o ADMIN, porque `GET /users` é exclusivo dele. A variante do BARBER (campo "ID do cliente", com o barbeiro fixo no usuário logado) é feita na Task 13. No pedido, vai `clientId`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `client books a slot`: escolher "Corte clássico", "Seu Jorge", a data `2026-11-03` e "09:00" e confirmar → o POST recebe `{serviceId:1, barberId:2, startsAt:"2026-11-03T09:00:00-03:00"}`, e aparece "Agendamento confirmado" com um link para "Meus agendamentos".
  - `shows times in Sao Paulo even with TZ=UTC`: o slot `...T09:00:00-03:00` é exibido como "09:00".
  - `slot taken returns to time step and reloads`: o POST devolve `409 {code:"SLOT_UNAVAILABLE", message:"Esse horário acabou de ser reservado. Escolha outro."}` → a mensagem aparece, o `availability` é chamado de novo, e serviço, barbeiro e data continuam selecionados.
  - `changing service clears chosen time`.
  - `confirm disabled while submitting`: dois cliques geram um único POST.
  - `admin must pick client first`: com `adminUser` e `forStaff`, o POST inclui o `clientId` escolhido.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): booking flow`.

---

### Task 7: Meus agendamentos (cliente)

**Files:**
- Create: `src/components/AppointmentCard.jsx`, `src/pages/client/MyAppointments.jsx`
- Test: `src/pages/client/MyAppointments.test.jsx`

**Interfaces:**
- Consumes: `appointments.list`, `appointments.cancel`, `formatDate`, `formatTime`, `formatPrice`.
- Produces: `<AppointmentCard appointment actions />`, que mostra data, hora, serviço, barbeiro (ou cliente, com a prop `showClient`), preço e status. Os rótulos de status são: SCHEDULED "Agendado", COMPLETED "Concluído", CANCELED "Cancelado" e NO_SHOW "Faltou". `actions` é um ReactNode.
- `canClientCancel(appointment, now = new Date()): boolean` → `status === "SCHEDULED"` e `startsAt - now >= 2h`. Exportada de `MyAppointments.jsx`.

A página divide os agendamentos em "Próximos" (`startsAt >= agora` e SCHEDULED) e "Histórico" (o resto, do mais recente para o mais antigo).

- [ ] **Step 1: Escrever os testes que falham:**
  - `canClientCancel true at exactly 2h, false at 1h59`.
  - `lists upcoming and history sections`.
  - `cancel asks confirmation and updates status`: clicar em "Cancelar", depois em "Sim, cancelar" (uma confirmação dentro da página, **não** `window.confirm`) → o PATCH é chamado e o card mostra "Cancelado".
  - `cancel hidden inside 2h window`.
  - `shows 422 message from API`: com `code "CANCELLATION_WINDOW_CLOSED"`, o `message` da API aparece.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): client appointments list and cancel`.

---

### Task 8: Agenda do barbeiro

**Files:**
- Create: `src/pages/barber/Agenda.jsx`, `src/components/CompleteDialog.jsx`
- Test: `src/pages/barber/Agenda.test.jsx`

**Interfaces:**
- Consumes: `appointments.list({from,to,barberId?})`, `complete`, `noShow`, `cancel`, `dayRange`, `AppointmentCard` (com `showClient`).
- Produces: `<Agenda barberFilter?: boolean />`, reaproveitada pelo admin na Task 10. Com `barberFilter`, aparece um `<select>` de barbeiros (via `barbers.list`) com a opção "Todos".
- `canFinish(appointment, now = new Date()): boolean` → `status === "SCHEDULED"` e `now >= startsAt`.

Barra superior com os botões "◀ Dia anterior", a data (`formatDate`) e "Próximo dia ▶", mais "Hoje". A lista vem ordenada por horário. Nos agendamentos SCHEDULED, aparecem os botões "Concluir", "Faltou" e "Cancelar". "Concluir" e "Faltou" ficam desabilitados antes do início, com o `title` "Disponível a partir do horário marcado". "Concluir" abre o `CompleteDialog`, que tem três opções de rádio (Dinheiro=`CASH`, Pix=`PIX`, Cartão=`CARD`) e o botão "Registrar pagamento".

- [ ] **Step 1: Escrever os testes que falham:**
  - `loads appointments for selected day`: a query enviada tem `from`/`to` igual a `dayRange(hoje)`; "Próximo dia" pede o dia seguinte.
  - `complete sends payment method`: escolher "Pix" envia o PATCH com o body `{paymentMethod:"PIX"}`, e o card mostra "Concluído".
  - `finish buttons disabled before start`: com `canFinish` falso, os botões ficam desabilitados.
  - `no-show marks Faltou`.
  - `empty day shows "Nenhum agendamento neste dia."`
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): barber agenda`.

---

### Task 9: Bloqueios do barbeiro

**Files:**
- Create: `src/pages/barber/TimeOff.jsx`
- Test: `src/pages/barber/TimeOff.test.jsx`

**Interfaces:**
- Consumes: `timeOff.list/create/remove`, `formatDate`, `formatTime`.

Formulário com os campos Data, Início (`HH:mm`), Fim (`HH:mm`) e Motivo (opcional). Ele monta `startsAt` e `endsAt` como `` `${date}T${hh:mm}:00-03:00` ``. Abaixo, a lista de bloqueios futuros com o botão "Remover".

- [ ] **Step 1: Escrever os testes que falham:**
  - `creates time off with Sao Paulo offset`: o body enviado é `{startsAt:"2026-11-03T12:00:00-03:00", endsAt:"2026-11-03T13:00:00-03:00", reason:"Almoço"}`.
  - `end before start blocked client-side`: aparece "O fim precisa ser depois do início."
  - `409 CONFLICTING_APPOINTMENTS lists conflicts`: com `details` contendo uma lista de appointments, a mensagem aparece junto com cada conflito no formato "09:00 · Ana · Corte clássico".
  - `remove deletes and refreshes list`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar. O componente de lista de conflitos fica em `src/components/ConflictList.jsx`, para ser reaproveitado na Task 12.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): barber time off`.

---

### Task 10: Admin, agenda geral e serviços

**Files:**
- Create: `src/pages/admin/AdminAgenda.jsx`, `src/pages/admin/Services.jsx`
- Test: `src/pages/admin/AdminAgenda.test.jsx`, `src/pages/admin/Services.test.jsx`

**Interfaces:**
- Consumes: `<Agenda barberFilter />` (Task 8), `<Booking forStaff />` (Task 6), `services.list/create/update/remove`, `formatPrice`.

A AdminAgenda tem duas abas: "Agenda" (com `<Agenda barberFilter />`) e "Novo agendamento" (com `<Booking forStaff />`).

Serviços aparecem numa tabela com as colunas Nome, Duração, Preço, Ativo e Ações (Editar e Desativar). O formulário tem Nome, Descrição, Preço (o usuário digita "45,00" e o sistema converte para `4500`) e Duração (`<select>` de 15 a 240, de 15 em 15).

- [ ] **Step 1: Escrever os testes que falham:**
  - `parsePriceInput("45,00") === 4500`, `parsePriceInput("45") === 4500`, `parsePriceInput("abc") === null` (exportada de `src/lib/money.js`).
  - `creates service with cents and duration`.
  - `deactivate calls DELETE and shows Inativo`.
  - `barber filter sends barberId`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): admin agenda and services`.

---

### Task 11: Admin, usuários

**Files:**
- Create: `src/pages/admin/Users.jsx`
- Test: `src/pages/admin/Users.test.jsx`

**Interfaces:**
- Consumes: `users.list/create/update`, `useAuth().user`.

Tabela com as colunas Nome, E-mail, Perfil (os rótulos são Cliente, Barbeiro e Administrador), Ativo e Ações. Há um filtro por perfil. O formulário de criação tem nome, e-mail, telefone, senha e perfil. A edição permite mudar nome, telefone, perfil, ativo e "Nova senha (opcional)".

- [ ] **Step 1: Escrever os testes que falham:**
  - `creates barber`: o body enviado tem `role:"BARBER"`.
  - `cannot deactivate or demote self`: na linha do próprio admin logado, o toggle de ativo e o select de perfil ficam desabilitados.
  - `409 email in use shows message`.
  - `edit omits password when empty`: o body do PATCH não tem a chave `password`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): admin users`.

---

### Task 12: Admin, horário de funcionamento

**Files:**
- Create: `src/pages/admin/BusinessHours.jsx`
- Test: `src/pages/admin/BusinessHours.test.jsx`

**Interfaces:**
- Consumes: `businessHours.get/put`, `ConflictList` (Task 9).

Sete linhas, de Domingo (0) a Sábado (6), cada uma com: Fechado (checkbox), Abre, Fecha, Intervalo de e Até (os dois últimos são opcionais). Quando "Fechado" está marcado, os outros campos ficam desabilitados. O botão "Salvar horários" envia um único PUT com as 7 linhas. Nas linhas fechadas, os horários vão como vieram do GET.

- [ ] **Step 1: Escrever os testes que falham:**
  - `renders 7 weekdays from API`.
  - `saves all rows in one PUT`: o body é um array de tamanho 7, com os valores editados.
  - `break must be inside opening hours`: um intervalo fora do expediente mostra "O intervalo precisa estar dentro do expediente." e não envia nada.
  - `409 CONFLICTING_APPOINTMENTS shows ConflictList`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit com a mensagem `feat(front): admin business hours`.

---

### Task 13: Atalho de agendamento do barbeiro, README e verificação final

**Files:**
- Modify: `src/pages/barber/Agenda.jsx` (botão "Novo agendamento")
- Create: `frontend/README.md`
- Test: `src/pages/barber/Agenda.test.jsx`

O barbeiro não acessa `GET /users`. Por isso, "Novo agendamento" na agenda dele abre a `<Booking forStaff />` numa variante em que o passo 0 é um campo **"ID do cliente"** numérico. O barbeiro fixo é o usuário logado, e o passo do barbeiro fica oculto. Essa é a menor solução que funciona sem uma rota nova no backend; anotar no README como limitação conhecida.

- [ ] **Step 1: Escrever o teste que falha:** `barber books for client id`: o POST recebe `{clientId: 5, barberId: barberUser.id, ...}`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar. O README cobre como rodar (`npm install`, `cp .env.example .env`, `npm run dev`, `npm test`), as rotas por perfil e a limitação acima.
- [ ] **Step 4:** Rodar a suíte inteira (`npm test -- --run`), esperando tudo PASS. Depois, `npm run build`, que deve terminar sem erros.
- [ ] **Step 5:** Commit com a mensagem `feat(front): barber quick booking, README`.
