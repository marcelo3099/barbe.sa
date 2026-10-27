export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export async function apiFetch(path, { method = "GET", body, query } = {}) {
  const headers = {};
  const token = localStorage.getItem("bt_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor.");
  }

  if (response.ok) {
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw new ApiError(response.status, "INTERNAL_ERROR", "Erro inesperado. Tente novamente.");
    }
  }

  if (response.status === 401 && !(method === "POST" && path === "/auth/login")) {
    unauthorizedHandler?.();
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // corpo ausente ou não-JSON
  }
  const err = payload?.error;
  if (err && typeof err.code === "string" && typeof err.message === "string") {
    throw new ApiError(response.status, err.code, err.message, err.details);
  }
  throw new ApiError(response.status, "INTERNAL_ERROR", "Erro inesperado. Tente novamente.");
}
