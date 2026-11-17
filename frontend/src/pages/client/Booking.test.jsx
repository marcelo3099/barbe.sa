import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, clientUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import Booking from "./Booking";

async function selectBasics({ service = "Corte clássico", barber = "Seu Jorge", date = "2026-11-03" } = {}) {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(service) }));
  await userEvent.click(await screen.findByRole("button", { name: barber }));
  const dateInput = await screen.findByDisplayValue("");
  fireEvent.change(dateInput, { target: { value: date } });
}

describe("Booking", () => {
  it("client books a slot", async () => {
    let body;
    server.use(
      http.get(`${BASE}/availability`, () => HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] })),
      http.post(`${BASE}/appointments`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 99 }, { status: 201 });
      }),
    );
    renderWithProviders(<Booking />, { user: clientUser });
    await selectBasics();
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Agendamento confirmado"));
    expect(screen.getByRole("link", { name: "Meus agendamentos" })).toBeInTheDocument();
    expect(body).toEqual({ serviceId: 1, barberId: 2, startsAt: "2026-11-03T09:00:00-03:00" });
  });

  it("shows times in Sao Paulo even with TZ=UTC", async () => {
    server.use(http.get(`${BASE}/availability`, () => HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] })));
    renderWithProviders(<Booking />, { user: clientUser });
    await selectBasics();
    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument();
  });

  it("slot taken returns to time step and reloads", async () => {
    let availabilityCalls = 0;
    server.use(
      http.get(`${BASE}/availability`, () => {
        availabilityCalls += 1;
        return HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] });
      }),
      http.post(`${BASE}/appointments`, () =>
        HttpResponse.json(
          { error: { code: "SLOT_UNAVAILABLE", message: "Esse horário acabou de ser reservado. Escolha outro." } },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<Booking />, { user: clientUser });
    await selectBasics();
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    await waitFor(() => expect(availabilityCalls).toBe(1));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse horário acabou de ser reservado. Escolha outro.");
    await waitFor(() => expect(availabilityCalls).toBe(2));
    expect(screen.queryByRole("button", { name: "Confirmar agendamento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Corte clássico/ })).toHaveClass("selected");
    expect(screen.getByRole("button", { name: "Seu Jorge" })).toHaveClass("selected");
  });

  it("changing service clears chosen time", async () => {
    server.use(http.get(`${BASE}/availability`, () => HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] })));
    renderWithProviders(<Booking />, { user: clientUser });
    await selectBasics();
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Barba/ }));
    expect(screen.queryByRole("button", { name: "Confirmar agendamento" })).not.toBeInTheDocument();
  });

  it("confirm disabled while submitting", async () => {
    server.use(
      http.get(`${BASE}/availability`, () => HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] })),
      http.post(`${BASE}/appointments`, () => new Promise(() => {})),
    );
    renderWithProviders(<Booking />, { user: clientUser });
    await selectBasics();
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
  });

  it("admin must pick client first", async () => {
    let body;
    server.use(
      http.get(`${BASE}/users`, () => HttpResponse.json([clientUser])),
      http.get(`${BASE}/availability`, () => HttpResponse.json({ date: "2026-11-03", slots: ["2026-11-03T09:00:00-03:00"] })),
      http.post(`${BASE}/appointments`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 100 }, { status: 201 });
      }),
    );
    renderWithProviders(<Booking forStaff />, { user: adminUser });
    expect(screen.queryByRole("button", { name: /Corte clássico/ })).not.toBeInTheDocument();
    const select = await screen.findByRole("combobox");
    await userEvent.selectOptions(select, String(clientUser.id));
    await selectBasics();
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(body?.clientId).toBe(clientUser.id));
  });
});
