import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { clientUser } from "../test/fixtures";
import { BASE } from "../test/handlers";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";
import { useAuth } from "./AuthContext";

function Probe() {
  const { user, loading, login, sessionMessage } = useAuth();
  return (
    <div>
      <p data-testid="state">{loading ? "loading" : user ? user.name : "anon"}</p>
      <p data-testid="msg">{sessionMessage ?? ""}</p>
      <button onClick={() => login("ana@x.com", "senha123")}>go</button>
    </div>
  );
}

describe("AuthContext", () => {
  it("restores session from stored token", async () => {
    renderWithProviders(<Probe />, { user: clientUser });
    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("Ana"));
  });

  it("is not loading without a token", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("anon");
  });

  it("login stores token and returns user", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.json({ token: "jwt-1", user: clientUser })));
    renderWithProviders(<Probe />);
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("Ana"));
    expect(localStorage.getItem("bt_token")).toBe("jwt-1");
  });

  it("expired token logs out with message", async () => {
    localStorage.setItem("bt_token", "old");
    server.use(
      http.get(`${BASE}/auth/me`, () =>
        HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Token inválido" } }, { status: 401 }),
      ),
    );
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("msg")).toHaveTextContent("Sua sessão expirou. Entre novamente."),
    );
    expect(localStorage.getItem("bt_token")).toBeNull();
    expect(screen.getByTestId("state")).toHaveTextContent("anon");
    expect(screen.getByTestId("location")).toHaveTextContent("/entrar");
  });
});
