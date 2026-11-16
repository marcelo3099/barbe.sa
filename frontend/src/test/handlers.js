import { http, HttpResponse } from "msw";
import { barbers, services } from "./fixtures";

import { API_BASE } from "../api/client";

export const BASE = API_BASE;

export const handlers = [
  http.get(`${BASE}/services`, () => HttpResponse.json(services)),
  http.get(`${BASE}/barbers`, () => HttpResponse.json(barbers)),
];
