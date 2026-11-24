import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { dayRange, todayISODate } from "../../lib/datetime";
import { appointment, barberUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import Agenda, { canFinish } from "./Agenda";

const HOUR = 3600 * 1000;

function iso(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString();
}

function captureQueries(responder) {
  const queries = [];
  server.use(
    http.get(`${BASE}/appointments`, ({ request }) => {
      const url = new URL(request.url);
      queries.push(Object.fromEntries(url.searchParams));
      return HttpResponse.json(responder ? responder(url) : []);
    }),
  );
  return queries;
}

describe("canFinish", () => {
  it("is true only for scheduled appointments that already started", () => {
    const now = new Date("2026-11-03T09:00:00-03:00");
    expect(canFinish(appointment({ startsAt: "2026-11-03T09:00:00-03:00" }), now)).toBe(true);
    expect(canFinish(appointment({ startsAt: "2026-11-03T09:15:00-03:00" }), now)).toBe(false);
    expect(canFinish(appointment({ startsAt: "2026-11-03T08:00:00-03:00", status: "COMPLETED" }), now)).toBe(false);
  });
});

describe("Agenda", () => {
  it("loads appointments for selected day", async () => {
    const queries = captureQueries();
    renderWithProviders(<Agenda />, { user: barberUser });
    const today = todayISODate();
    await waitFor(() => expect(queries.length).toBe(1));
    expect(queries[0]).toEqual(dayRange(today));
    await userEvent.click(screen.getByRole("button", { name: "Próximo dia ▶" }));
    const tomorrow = todayISODate(new Date(new Date(`${today}T12:00:00-03:00`).getTime() + 24 * HOUR));
    await waitFor(() => expect(queries.length).toBe(2));
    expect(queries[1]).toEqual(dayRange(tomorrow));
  });

  it("complete sends payment method", async () => {
    let body;
    const appt = appointment({ id: 11, startsAt: iso(-HOUR) });
    captureQueries(() => [appt]);
    server.use(
      http.patch(`${BASE}/appointments/11/complete`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...appt, status: "COMPLETED", paymentMethod: body.paymentMethod });
      }),
    );
    renderWithProviders(<Agenda />, { user: barberUser });
    await userEvent.click(await screen.findByRole("button", { name: "Concluir" }));
    await userEvent.click(screen.getByLabelText("Pix"));
    await userEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(screen.getByText("Concluído")).toBeInTheDocument());
    expect(body).toEqual({ paymentMethod: "PIX" });
  });

  it("finish buttons disabled before start", async () => {
    captureQueries(() => [appointment({ startsAt: iso(2 * HOUR) })]);
    renderWithProviders(<Agenda />, { user: barberUser });
    const complete = await screen.findByRole("button", { name: "Concluir" });
    expect(complete).toBeDisabled();
    expect(complete).toHaveAttribute("title", "Disponível a partir do horário marcado");
    expect(screen.getByRole("button", { name: "Faltou" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("no-show marks Faltou", async () => {
    const appt = appointment({ id: 12, startsAt: iso(-HOUR) });
    captureQueries(() => [appt]);
    server.use(http.patch(`${BASE}/appointments/12/no-show`, () => HttpResponse.json({ ...appt, status: "NO_SHOW" })));
    renderWithProviders(<Agenda />, { user: barberUser });
    await userEvent.click(await screen.findByRole("button", { name: "Faltou" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Faltou" })).not.toBeInTheDocument());
    expect(screen.getByText("Faltou")).toBeInTheDocument();
  });

  it('empty day shows "Nenhum agendamento neste dia."', async () => {
    captureQueries();
    renderWithProviders(<Agenda />, { user: barberUser });
    expect(await screen.findByText("Nenhum agendamento neste dia.")).toBeInTheDocument();
  });
});
