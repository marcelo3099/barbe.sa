import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { clientUser } from "../test/fixtures";
import { BASE } from "../test/handlers";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";

async function fillBase() {
  await userEvent.type(screen.getByLabelText("Nome"), "Ana");
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@x.com");
}

describe("Register", () => {
  it("register shows field errors from details", async () => {
    server.use(
      http.post(`${BASE}/auth/register`, () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { email: ["E-mail já cadastrado"] } } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<App />, { route: "/cadastro" });
    await fillBase();
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("E-mail já cadastrado")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-describedby", "email-error");
  });

  it("register blocks short password client-side", async () => {
    let called = false;
    server.use(
      http.post(`${BASE}/auth/register`, () => {
        called = true;
        return HttpResponse.json(clientUser);
      }),
    );
    renderWithProviders(<App />, { route: "/cadastro" });
    await fillBase();
    await userEvent.type(screen.getByLabelText("Senha"), "1234567");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("register redirects CLIENT to /agendar on success", async () => {
    server.use(
      http.post(`${BASE}/auth/register`, () => HttpResponse.json(clientUser)),
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({ token: "jwt-2", user: clientUser })),
    );
    renderWithProviders(<App />, { route: "/cadastro" });
    await fillBase();
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/agendar$/));
  });

  it("submit button disabled while pending", async () => {
    server.use(http.post(`${BASE}/auth/register`, () => new Promise(() => {})));
    renderWithProviders(<App />, { route: "/cadastro" });
    await fillBase();
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeDisabled();
  });
});
