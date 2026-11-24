# Barber Time — Frontend

SPA em React + Vite que consome a API do `backend/` (contrato da seção 7.1 do spec em `docs/superpowers/specs/`).

## Como rodar

Pré-requisito: a API rodando em `http://localhost:3333` (veja `backend/README.md`).

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3333/api
npm run dev            # http://localhost:5173
```

Testes e build:

```bash
npm test               # Vitest em modo watch, com TZ=UTC
npm test -- --run      # roda uma vez
npm run build          # gera dist/
```

Os testes simulam a API com MSW e rodam no fuso UTC de propósito: todo horário da interface é exibido no fuso `America/Sao_Paulo`, qualquer que seja o fuso do navegador.

## Rotas por perfil

| Perfil | Rotas |
|---|---|
| Visitante | `/` (home e serviços), `/entrar`, `/cadastro` |
| Cliente | `/agendar`, `/meus-agendamentos` |
| Barbeiro | `/agenda` (agenda do dia, concluir, falta, cancelar e novo agendamento), `/bloqueios` |
| Admin | `/admin/agenda` (agenda geral e novo agendamento), `/admin/servicos`, `/admin/usuarios`, `/admin/horarios` |

Depois do login, cada perfil vai para a sua página inicial: cliente → `/agendar`, barbeiro → `/agenda`, admin → `/admin/agenda`. Qualquer resposta `401` encerra a sessão e volta para `/entrar` com a mensagem "Sua sessão expirou. Entre novamente."

O token JWT fica no `localStorage` (chave `bt_token`). A checagem de perfil no front existe só para a navegação; quem garante a segurança é a API.

## Limitação conhecida

O barbeiro não tem acesso a `GET /users`. Por isso, em "Novo agendamento" na agenda dele, o cliente é informado pelo **ID do cliente** (numérico), e não escolhido numa lista. O admin escolhe o cliente numa lista normalmente. Resolver isso exigiria uma rota nova no backend (por exemplo, busca de clientes acessível ao barbeiro).
