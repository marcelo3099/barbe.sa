import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { barberUser } from "../test/fixtures";
import { BASE } from "../test/handlers";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";

async function fillLogin(email = "jorge@x.com", password = "senha123") {
  await userEvent.type(screen.getByLabelText("E-mail"), email);
  await userEvent.type(screen.getByLabelText("Senha"), password);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Login", () => {
  it("login redirects BARBER to /agenda", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.json({ token: "jwt-1", user: barberUser })));
    renderWithProviders(<App />, { route: "/entrar" });
    await fillLogin();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/agenda$/));
  });

  it("login shows INVALID_CREDENTIALS message", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos" } }, { status: 401 }),
      ),
    );
    renderWithProviders(<App />, { route: "/entrar" });
    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos");
  });

  it("login shows session expired message", async () => {
    localStorage.setItem("bt_token", "old");
    server.use(
      http.get(`${BASE}/auth/me`, () =>
        HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Token inválido" } }, { status: 401 }),
      ),
    );
    renderWithProviders(<App />, { route: "/agendar" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
  });

  it("submit button disabled while pending", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => new Promise(() => {})));
    renderWithProviders(<App />, { route: "/entrar" });
    await userEvent.type(screen.getByLabelText("E-mail"), "jorge@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });
});
