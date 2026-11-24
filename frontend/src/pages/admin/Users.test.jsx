import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, barberUser, clientUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import Users from "./Users";

function useUsers(list = [adminUser, barberUser, clientUser]) {
  const queries = [];
  server.use(
    http.get(`${BASE}/users`, ({ request }) => {
      const role = new URL(request.url).searchParams.get("role");
      queries.push(role);
      return HttpResponse.json(role ? list.filter((u) => u.role === role) : list);
    }),
  );
  return queries;
}

async function rowOf(name) {
  return (await screen.findByRole("cell", { name })).closest("tr");
}

async function fillCreate({ role = "BARBER" } = {}) {
  const form = screen.getByRole("form", { name: "Novo usuário" });
  await userEvent.type(within(form).getByLabelText("Nome"), "Zé Navalha");
  await userEvent.type(within(form).getByLabelText("E-mail"), "ze@x.com");
  await userEvent.type(within(form).getByLabelText("Telefone (opcional)"), "48999993333");
  await userEvent.type(within(form).getByLabelText("Senha"), "segredo123");
  await userEvent.selectOptions(within(form).getByLabelText("Perfil"), role);
  return form;
}

describe("Admin Users", () => {
  it("lists users with role labels and filters by role", async () => {
    const queries = useUsers();
    renderWithProviders(<Users />, { user: adminUser });
    const row = await rowOf("Seu Jorge");
    expect(within(row).getByText("Barbeiro")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por perfil"), "CLIENT");
    await waitFor(() => expect(queries).toContain("CLIENT"));
    await waitFor(() => expect(screen.queryByRole("cell", { name: "Seu Jorge" })).not.toBeInTheDocument());
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
  });

  it("creates barber", async () => {
    useUsers();
    let body;
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 9, active: true, name: body.name, email: body.email, phone: body.phone, role: body.role }, { status: 201 });
      }),
    );
    renderWithProviders(<Users />, { user: adminUser });
    await rowOf("Seu Jorge");
    const form = await fillCreate();
    await userEvent.click(within(form).getByRole("button", { name: "Criar usuário" }));
    await waitFor(() =>
      expect(body).toEqual({ name: "Zé Navalha", email: "ze@x.com", phone: "48999993333", password: "segredo123", role: "BARBER" }),
    );
    expect(await screen.findByRole("cell", { name: "Zé Navalha" })).toBeInTheDocument();
  });

  it("cannot deactivate or demote self", async () => {
    useUsers();
    renderWithProviders(<Users />, { user: adminUser });
    const own = await rowOf("Marcelo");
    await userEvent.click(within(own).getByRole("button", { name: "Editar" }));
    const form = screen.getByRole("form", { name: "Editar usuário" });
    expect(within(form).getByLabelText("Perfil")).toBeDisabled();
    expect(within(form).getByLabelText("Ativo")).toBeDisabled();

    await userEvent.click(within(await rowOf("Seu Jorge")).getByRole("button", { name: "Editar" }));
    const other = screen.getByRole("form", { name: "Editar usuário" });
    expect(within(other).getByLabelText("Perfil")).toBeEnabled();
    expect(within(other).getByLabelText("Ativo")).toBeEnabled();
  });

  it("409 email in use shows message", async () => {
    useUsers();
    server.use(
      http.post(`${BASE}/users`, () =>
        HttpResponse.json({ error: { code: "EMAIL_IN_USE", message: "E-mail já cadastrado" } }, { status: 409 }),
      ),
    );
    renderWithProviders(<Users />, { user: adminUser });
    await rowOf("Seu Jorge");
    const form = await fillCreate();
    await userEvent.click(within(form).getByRole("button", { name: "Criar usuário" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail já cadastrado");
  });

  it("edit omits password when empty", async () => {
    useUsers();
    let body;
    server.use(
      http.patch(`${BASE}/users/2`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...barberUser, ...body });
      }),
    );
    renderWithProviders(<Users />, { user: adminUser });
    await userEvent.click(within(await rowOf("Seu Jorge")).getByRole("button", { name: "Editar" }));
    const form = screen.getByRole("form", { name: "Editar usuário" });
    const name = within(form).getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Jorge Navalha");
    await userEvent.click(within(form).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ name: "Jorge Navalha", role: "BARBER", active: true });
    expect(await screen.findByRole("cell", { name: "Jorge Navalha" })).toBeInTheDocument();
  });
});
