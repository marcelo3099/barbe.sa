import { http, HttpResponse } from "msw";
import { barbers, services } from "./fixtures";

export const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api";

export const handlers = [
  http.get(`${BASE}/services`, () => HttpResponse.json(services)),
  http.get(`${BASE}/barbers`, () => HttpResponse.json(barbers)),
];
