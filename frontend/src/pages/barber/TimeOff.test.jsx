import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { appointment, barberUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import TimeOff from "./TimeOff";

const DAY = 24 * 3600 * 1000;

function futureBlock(id, reason) {
  const start = new Date(Date.now() + 2 * DAY);
  return { id, barberId: 2, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(), reason };
}

async function fillForm({ date = "2026-11-03", start = "12:00", end = "13:00", reason = "Almoço" } = {}) {
  fireEvent.change(await screen.findByLabelText("Data"), { target: { value: date } });
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: start } });
  fireEvent.change(screen.getByLabelText("Fim"), { target: { value: end } });
  if (reason) await userEvent.type(screen.getByLabelText("Motivo (opcional)"), reason);
}

describe("TimeOff", () => {
  it("creates time off with Sao Paulo offset", async () => {
    let body;
    server.use(
      http.get(`${BASE}/time-off`, () => HttpResponse.json([])),
      http.post(`${BASE}/time-off`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 1, barberId: 2, ...body }, { status: 201 });
      }),
    );
    renderWithProviders(<TimeOff />, { user: barberUser });
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Bloquear horário" }));
    await waitFor(() =>
      expect(body).toEqual({ startsAt: "2026-11-03T12:00:00-03:00", endsAt: "2026-11-03T13:00:00-03:00", reason: "Almoço" }),
    );
  });

  it("end before start blocked client-side", async () => {
    let posts = 0;
    server.use(
      http.get(`${BASE}/time-off`, () => HttpResponse.json([])),
      http.post(`${BASE}/time-off`, () => {
        posts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderWithProviders(<TimeOff />, { user: barberUser });
    await fillForm({ start: "13:00", end: "12:00" });
    await userEvent.click(screen.getByRole("button", { name: "Bloquear horário" }));
    expect(await screen.findByText("O fim precisa ser depois do início.")).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it("409 CONFLICTING_APPOINTMENTS lists conflicts", async () => {
    server.use(
      http.get(`${BASE}/time-off`, () => HttpResponse.json([])),
      http.post(`${BASE}/time-off`, () =>
        HttpResponse.json(
          {
            error: {
              code: "CONFLICTING_APPOINTMENTS",
              message: "Existem agendamentos nesse período.",
              details: [appointment()],
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<TimeOff />, { user: barberUser });
    await fillForm({ start: "08:00", end: "10:00" });
    await userEvent.click(screen.getByRole("button", { name: "Bloquear horário" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Existem agendamentos nesse período.");
    expect(screen.getByText("09:00 · Ana · Corte clássico")).toBeInTheDocument();
  });

  it("remove deletes and refreshes list", async () => {
    let blocks = [futureBlock(1, "Dentista"), futureBlock(2, "Banco")];
    let deleted = null;
    server.use(
      http.get(`${BASE}/time-off`, () => HttpResponse.json(blocks)),
      http.delete(`${BASE}/time-off/:id`, ({ params }) => {
        deleted = Number(params.id);
        blocks = blocks.filter((b) => b.id !== deleted);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<TimeOff />, { user: barberUser });
    expect(await screen.findByText(/Dentista/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    await waitFor(() => expect(screen.queryByText(/Dentista/)).not.toBeInTheDocument());
    expect(deleted).toBe(1);
    expect(screen.getByText(/Banco/)).toBeInTheDocument();
  });
});
