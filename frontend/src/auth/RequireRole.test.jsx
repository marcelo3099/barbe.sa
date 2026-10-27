import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { barberUser, clientUser } from "../test/fixtures";
import { renderWithProviders } from "../test/renderWithProviders";

describe("RequireRole", () => {
  it("redirects anonymous to /entrar", async () => {
    renderWithProviders(<App />, { route: "/agendar" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/entrar"));
  });

  it("redirects BARBER away from /agendar to /agenda", async () => {
    renderWithProviders(<App />, { route: "/agendar", user: barberUser });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/agenda"));
  });

  it("lets the right role through", async () => {
    renderWithProviders(<App />, { route: "/agendar", user: clientUser });
    expect(await screen.findByRole("heading", { name: "Agendar" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/agendar");
  });

  it("shows loading while the session is restored", async () => {
    renderWithProviders(<App />, { route: "/agendar", user: clientUser });
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Agendar" });
  });
});
