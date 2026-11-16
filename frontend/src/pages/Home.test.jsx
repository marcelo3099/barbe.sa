import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { clientUser } from "../test/fixtures";
import { BASE } from "../test/handlers";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";

describe("Home", () => {
  it("lists active services with prices", async () => {
    renderWithProviders(<App />, { route: "/" });
    expect(await screen.findByText("Corte clássico")).toBeInTheDocument();
    expect(screen.getByText("R$ 45,00")).toBeInTheDocument();
  });

  it("reserve button goes to /entrar when anonymous", async () => {
    renderWithProviders(<App />, { route: "/" });
    await userEvent.click(screen.getByRole("link", { name: "Reservar cadeira" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/entrar$/);
  });

  it("reserve button goes to /agendar for client", async () => {
    renderWithProviders(<App />, { route: "/", user: clientUser });
    await screen.findByRole("button", { name: "Sair" });
    await userEvent.click(screen.getByRole("link", { name: "Reservar cadeira" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/agendar$/);
  });

  it("shows error when services fail", async () => {
    server.use(
      http.get(`${BASE}/services`, () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "Erro interno" } }, { status: 500 }),
      ),
    );
    renderWithProviders(<App />, { route: "/" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");
  });
});
