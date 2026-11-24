import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { appointment, clientUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import MyAppointments, { canClientCancel } from "./MyAppointments";

const HOUR = 3600 * 1000;

function iso(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString();
}

describe("canClientCancel", () => {
  it("canClientCancel true at exactly 2h, false at 1h59", () => {
    const now = new Date("2026-11-03T07:00:00-03:00");
    expect(canClientCancel(appointment({ startsAt: "2026-11-03T09:00:00-03:00" }), now)).toBe(true);
    expect(canClientCancel(appointment({ startsAt: "2026-11-03T08:59:00-03:00" }), now)).toBe(false);
    expect(canClientCancel(appointment({ startsAt: "2026-11-03T09:00:00-03:00", status: "CANCELED" }), now)).toBe(false);
  });
});

describe("MyAppointments", () => {
  it("lists upcoming and history sections", async () => {
    server.use(
      http.get(`${BASE}/appointments`, () =>
        HttpResponse.json([
          appointment({ id: 1, startsAt: iso(-48 * HOUR), status: "COMPLETED", service: { id: 2, name: "Barba", durationMinutes: 30 } }),
          appointment({ id: 2, startsAt: iso(24 * HOUR) }),
        ]),
      ),
    );
    renderWithProviders(<MyAppointments />, { user: clientUser });
    const upcoming = await screen.findByRole("region", { name: "Próximos" });
    const history = screen.getByRole("region", { name: "Histórico" });
    expect(within(upcoming).getByText("Corte clássico")).toBeInTheDocument();
    expect(within(history).getByText("Barba")).toBeInTheDocument();
    expect(within(history).getByText("Concluído")).toBeInTheDocument();
  });

  it("cancel asks confirmation and updates status", async () => {
    let cancelCalls = 0;
    const appt = appointment({ id: 7, startsAt: iso(24 * HOUR) });
    server.use(
      http.get(`${BASE}/appointments`, () => HttpResponse.json([appt])),
      http.patch(`${BASE}/appointments/7/cancel`, () => {
        cancelCalls += 1;
        return HttpResponse.json({ ...appt, status: "CANCELED" });
      }),
    );
    renderWithProviders(<MyAppointments />, { user: clientUser });
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(cancelCalls).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));
    await waitFor(() => expect(screen.getByText("Cancelado")).toBeInTheDocument());
    expect(cancelCalls).toBe(1);
  });

  it("cancel hidden inside 2h window", async () => {
    server.use(http.get(`${BASE}/appointments`, () => HttpResponse.json([appointment({ startsAt: iso(HOUR) })])));
    renderWithProviders(<MyAppointments />, { user: clientUser });
    expect(await screen.findByText("Corte clássico")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("shows 422 message from API", async () => {
    server.use(
      http.get(`${BASE}/appointments`, () => HttpResponse.json([appointment({ id: 8, startsAt: iso(24 * HOUR) })])),
      http.patch(`${BASE}/appointments/8/cancel`, () =>
        HttpResponse.json(
          { error: { code: "CANCELLATION_WINDOW_CLOSED", message: "O cancelamento só é permitido até 2 horas antes." } },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<MyAppointments />, { user: clientUser });
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O cancelamento só é permitido até 2 horas antes.");
  });
});
