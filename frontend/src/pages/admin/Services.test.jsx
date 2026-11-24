import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, services } from "../../test/fixtures";
import { BASE } from "../../test/handlers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import Services from "./Services";

describe("Admin Services", () => {
  it("lists services including inactive", async () => {
    let query;
    server.use(
      http.get(`${BASE}/services`, ({ request }) => {
        query = new URL(request.url).searchParams.get("includeInactive");
        return HttpResponse.json(services);
      }),
    );
    renderWithProviders(<Services />, { user: adminUser });
    expect(await screen.findByRole("cell", { name: "Corte clássico" })).toBeInTheDocument();
    expect(query).toBe("true");
  });

  it("creates service with cents and duration", async () => {
    let body;
    server.use(
      http.post(`${BASE}/services`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 3, active: true, ...body }, { status: 201 });
      }),
    );
    renderWithProviders(<Services />, { user: adminUser });
    await screen.findByRole("cell", { name: "Corte clássico" });
    await userEvent.type(screen.getByLabelText("Nome"), "Pezinho");
    await userEvent.type(screen.getByLabelText("Descrição"), "Acabamento");
    await userEvent.type(screen.getByLabelText("Preço"), "20,00");
    await userEvent.selectOptions(screen.getByLabelText("Duração"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Criar serviço" }));
    await waitFor(() =>
      expect(body).toEqual({ name: "Pezinho", description: "Acabamento", priceCents: 2000, durationMinutes: 15 }),
    );
    expect(await screen.findByRole("cell", { name: "Pezinho" })).toBeInTheDocument();
  });

  it("blocks invalid price client-side", async () => {
    renderWithProviders(<Services />, { user: adminUser });
    await screen.findByRole("cell", { name: "Corte clássico" });
    await userEvent.type(screen.getByLabelText("Nome"), "Pezinho");
    await userEvent.type(screen.getByLabelText("Preço"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Criar serviço" }));
    expect(await screen.findByText("Informe um preço válido, por exemplo 45,00.")).toBeInTheDocument();
  });

  it("deactivate calls DELETE and shows Inativo", async () => {
    let deleted = false;
    server.use(
      http.delete(`${BASE}/services/1`, () => {
        deleted = true;
        return HttpResponse.json({ ...services[0], active: false });
      }),
    );
    renderWithProviders(<Services />, { user: adminUser });
    const row = (await screen.findByRole("cell", { name: "Corte clássico" })).closest("tr");
    await userEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(within(row).getByText("Inativo")).toBeInTheDocument());
    expect(deleted).toBe(true);
  });

  it("edit sends PATCH with changed values", async () => {
    let body;
    server.use(
      http.patch(`${BASE}/services/1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...services[0], ...body });
      }),
    );
    renderWithProviders(<Services />, { user: adminUser });
    const row = (await screen.findByRole("cell", { name: "Corte clássico" })).closest("tr");
    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const price = screen.getByLabelText("Preço");
    expect(price).toHaveValue("45,00");
    await userEvent.clear(price);
    await userEvent.type(price, "50");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(body?.priceCents).toBe(5000));
    expect(await screen.findByRole("cell", { name: "R$ 50,00" })).toBeInTheDocument();
  });

  it("shows field details from a 400", async () => {
    server.use(
      http.post(`${BASE}/services`, () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { description: ["Descrição muito longa"] } } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<Services />, { user: adminUser });
    await screen.findByRole("cell", { name: "Corte clássico" });
    await userEvent.type(screen.getByLabelText("Nome"), "Pezinho");
    await userEvent.type(screen.getByLabelText("Preço"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Criar serviço" }));
    expect(await screen.findByText("Descrição muito longa")).toBeInTheDocument();
  });
});
