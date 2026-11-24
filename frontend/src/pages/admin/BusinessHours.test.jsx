import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, appointment } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import BusinessHours from "./BusinessHours";

const ROWS = [
  { weekday: 0, opensAt: "09:00", closesAt: "18:00", breakStartsAt: null, breakEndsAt: null, closed: true },
  ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt: "09:00",
    closesAt: "20:00",
    breakStartsAt: "12:00",
    breakEndsAt: "13:00",
    closed: weekday === 1,
  })),
];

function serve({ put } = {}) {
  const puts = [];
  server.use(
    http.get(`${BASE}/business-hours`, () => HttpResponse.json(ROWS)),
    http.put(`${BASE}/business-hours`, async ({ request }) => {
      const body = await request.json();
      puts.push(body);
      return put ? put(body) : HttpResponse.json(body);
    }),
  );
  return puts;
}

describe("BusinessHours", () => {
  it("renders 7 weekdays from API", async () => {
    serve();
    renderWithProviders(<BusinessHours />, { user: adminUser });
    for (const day of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
      expect(await screen.findByRole("rowheader", { name: day })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Fechado (Domingo)")).toBeChecked();
    expect(screen.getByLabelText("Abre (Domingo)")).toBeDisabled();
    expect(screen.getByLabelText("Abre (Terça)")).toHaveValue("09:00");
  });

  it("saves all rows in one PUT", async () => {
    const puts = serve();
    renderWithProviders(<BusinessHours />, { user: adminUser });
    fireEvent.change(await screen.findByLabelText("Fecha (Sábado)"), { target: { value: "16:00" } });
    fireEvent.change(screen.getByLabelText("Intervalo de (Sábado)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Até (Sábado)"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toHaveLength(7);
    expect(puts[0][6]).toEqual({ weekday: 6, opensAt: "09:00", closesAt: "16:00", breakStartsAt: null, breakEndsAt: null, closed: false });
    expect(puts[0][1]).toEqual(ROWS[1]);
    expect(await screen.findByRole("status")).toHaveTextContent("Horários salvos.");
  });

  it("break must be inside opening hours", async () => {
    const puts = serve();
    renderWithProviders(<BusinessHours />, { user: adminUser });
    fireEvent.change(await screen.findByLabelText("Até (Terça)"), { target: { value: "21:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    expect(await screen.findByText("O intervalo precisa estar dentro do expediente.")).toBeInTheDocument();
    expect(puts.length).toBe(0);
  });

  it("409 CONFLICTING_APPOINTMENTS shows ConflictList", async () => {
    serve({
      put: () =>
        HttpResponse.json(
          { error: { code: "CONFLICTING_APPOINTMENTS", message: "Há agendamentos fora do novo horário.", details: [appointment()] } },
          { status: 409 },
        ),
    });
    renderWithProviders(<BusinessHours />, { user: adminUser });
    await userEvent.click(await screen.findByLabelText("Fechado (Terça)"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Há agendamentos fora do novo horário.");
    expect(screen.getByText(/09:00 · Ana · Corte clássico/)).toBeInTheDocument();
  });
});
