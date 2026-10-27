import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { BASE } from "../test/handlers";
import { services } from "../test/fixtures";
import { apiFetch, ApiError, setUnauthorizedHandler } from "./client";
import { appointments, services as servicesApi, users, timeOff } from "./endpoints";

const onUnauthorized = vi.fn();

beforeEach(() => {
  onUnauthorized.mockReset();
  setUnauthorizedHandler(onUnauthorized);
});

async function catchError(promise) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error("expected rejection");
}

describe("apiFetch", () => {
  it("sends bearer token when present", async () => {
    localStorage.setItem("bt_token", "abc");
    let auth;
    server.use(
      http.get(`${BASE}/auth/me`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ id: 1 });
      }),
    );
    await apiFetch("/auth/me");
    expect(auth).toBe("Bearer abc");
  });

  it("returns parsed json", async () => {
    expect(await apiFetch("/services")).toEqual(services);
  });

  it("returns null on 204", async () => {
    server.use(http.delete(`${BASE}/time-off/3`, () => new HttpResponse(null, { status: 204 })));
    expect(await apiFetch("/time-off/3", { method: "DELETE" })).toBeNull();
  });

  it("sends json body and omits empty query values", async () => {
    let seen;
    server.use(
      http.post(`${BASE}/things`, async ({ request }) => {
        seen = { url: new URL(request.url), ct: request.headers.get("content-type"), body: await request.json() };
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/things", {
      method: "POST",
      body: { a: 1 },
      query: { x: "1", y: undefined, z: null, w: "", n: 0 },
    });
    expect(seen.ct).toMatch(/application\/json/);
    expect(seen.body).toEqual({ a: 1 });
    expect(seen.url.search).toBe("?x=1&n=0");
  });

  it("throws ApiError with code, message and details", async () => {
    server.use(
      http.post(`${BASE}/auth/register`, () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { email: ["E-mail inválido"] } } },
          { status: 400 },
        ),
      ),
    );
    const err = await catchError(apiFetch("/auth/register", { method: "POST", body: {} }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Dados inválidos");
    expect(err.details.email[0]).toBe("E-mail inválido");
  });

  it("calls unauthorized handler on 401", async () => {
    server.use(
      http.get(`${BASE}/auth/me`, () =>
        HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Sessão inválida" } }, { status: 401 }),
      ),
    );
    await catchError(apiFetch("/auth/me"));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not call unauthorized handler on login 401", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos" } }, { status: 401 }),
      ),
    );
    const err = await catchError(apiFetch("/auth/login", { method: "POST", body: {} }));
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(err.code).toBe("INVALID_CREDENTIALS");
  });

  it("network failure becomes friendly ApiError", async () => {
    server.use(http.get(`${BASE}/services`, () => HttpResponse.error()));
    const err = await catchError(apiFetch("/services"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.message).toBe("Não foi possível conectar ao servidor.");
  });

  it("non-json 500 becomes INTERNAL_ERROR", async () => {
    server.use(http.get(`${BASE}/services`, () => new HttpResponse(null, { status: 500 })));
    const err = await catchError(apiFetch("/services"));
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Erro inesperado. Tente novamente.");
  });
});

describe("endpoints", () => {
  it("builds queries and bodies per the contract", async () => {
    const seen = [];
    server.use(
      http.all(`${BASE}/*`, async ({ request }) => {
        const url = new URL(request.url);
        const text = await request.text();
        seen.push(`${request.method} ${url.pathname}${url.search} ${text}`.trim());
        return HttpResponse.json({});
      }),
    );
    await servicesApi.list();
    await servicesApi.list({ includeInactive: true });
    await users.list({ role: "BARBER" });
    await appointments.list({ from: "2026-11-01", to: "2026-11-30", status: "SCHEDULED", barberId: 2 });
    await appointments.cancel(4, "Imprevisto");
    await appointments.cancel(4);
    await appointments.complete(4, "PIX");
    await appointments.noShow(4);
    await timeOff.list({ barberId: 2 });
    expect(seen).toEqual([
      "GET /api/services",
      "GET /api/services?includeInactive=true",
      "GET /api/users?role=BARBER",
      "GET /api/appointments?from=2026-11-01&to=2026-11-30&status=SCHEDULED&barberId=2",
      'PATCH /api/appointments/4/cancel {"reason":"Imprevisto"}',
      "PATCH /api/appointments/4/cancel {}",
      'PATCH /api/appointments/4/complete {"paymentMethod":"PIX"}',
      "PATCH /api/appointments/4/no-show {}",
      "GET /api/time-off?barberId=2",
    ]);
  });
});
