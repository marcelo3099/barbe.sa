import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { ROUTER_FUTURE } from "../routerFuture";
import { BASE } from "./handlers";
import { server } from "./server";

export function LocationDisplay() {
  const { pathname, hash } = useLocation();
  return <div data-testid="location">{pathname + hash}</div>;
}

export function renderWithProviders(ui, { route = "/", user = null } = {}) {
  if (user) {
    localStorage.setItem("bt_token", "test-token");
    server.use(http.get(`${BASE}/auth/me`, () => HttpResponse.json(user)));
  }
  return render(
    <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>
      <AuthProvider>
        {ui}
        <LocationDisplay />
      </AuthProvider>
    </MemoryRouter>,
  );
}
