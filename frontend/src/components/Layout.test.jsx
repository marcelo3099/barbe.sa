import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { adminUser, barberUser, clientUser } from "../test/fixtures";
import { renderWithProviders } from "../test/renderWithProviders";

describe("Layout", () => {
  it("shows visitor links", () => {
    renderWithProviders(<App />);
    expect(screen.getByRole("link", { name: "Serviços" })).toHaveAttribute("href", "/#servicos");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
  });

  it("shows client links", async () => {
    renderWithProviders(<App />, { user: clientUser });
    expect(await screen.findByRole("link", { name: "Agendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus agendamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("shows barber links", async () => {
    renderWithProviders(<App />, { user: barberUser });
    expect(await screen.findByRole("link", { name: "Bloqueios" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/agenda");
  });

  it("shows admin links", async () => {
    renderWithProviders(<App />, { user: adminUser });
    for (const name of ["Agenda", "Serviços", "Usuários", "Horários"]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("Sair logs out and goes home", async () => {
    renderWithProviders(<App />, { route: "/agendar", user: clientUser });
    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    expect(localStorage.getItem("bt_token")).toBeNull();
  });
});
