import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, clientUser } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import AdminAgenda from "./AdminAgenda";

describe("AdminAgenda", () => {
  it("barber filter sends barberId", async () => {
    const queries = [];
    server.use(
      http.get(`${BASE}/appointments`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("barberId"));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<AdminAgenda />, { user: adminUser });
    await waitFor(() => expect(queries.length).toBe(1));
    expect(queries[0]).toBe(null);
    const select = await screen.findByLabelText("Barbeiro");
    await screen.findByRole("option", { name: "Seu Jorge" });
    await userEvent.selectOptions(select, "2");
    await waitFor(() => expect(queries).toContain("2"));
  });

  it("new appointment tab shows staff booking with client picker", async () => {
    server.use(
      http.get(`${BASE}/appointments`, () => HttpResponse.json([])),
      http.get(`${BASE}/users`, () => HttpResponse.json([clientUser])),
    );
    renderWithProviders(<AdminAgenda />, { user: adminUser });
    await userEvent.click(screen.getByRole("tab", { name: "Novo agendamento" }));
    expect(await screen.findByRole("option", { name: "Ana" })).toBeInTheDocument();
  });
});
