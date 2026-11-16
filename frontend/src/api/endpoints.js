import { apiFetch } from "./client";

export const auth = {
  register: (data) => apiFetch("/auth/register", { method: "POST", body: data }),
  login: (data) => apiFetch("/auth/login", { method: "POST", body: data }),
  me: () => apiFetch("/auth/me"),
};

export const services = {
  list: ({ includeInactive } = {}) =>
    apiFetch("/services", { query: { includeInactive: includeInactive ? "true" : undefined } }),
  create: (data) => apiFetch("/services", { method: "POST", body: data }),
  update: (id, data) => apiFetch(`/services/${id}`, { method: "PATCH", body: data }),
  remove: (id) => apiFetch(`/services/${id}`, { method: "DELETE" }),
};

export const barbers = {
  list: () => apiFetch("/barbers"),
};

export const availability = {
  get: ({ barberId, serviceId, date }) => apiFetch("/availability", { query: { barberId, serviceId, date } }),
};

export const businessHours = {
  get: () => apiFetch("/business-hours"),
  put: (rows) => apiFetch("/business-hours", { method: "PUT", body: rows }),
};

export const timeOff = {
  list: ({ barberId } = {}) => apiFetch("/time-off", { query: { barberId } }),
  create: (data) => apiFetch("/time-off", { method: "POST", body: data }),
  remove: (id) => apiFetch(`/time-off/${id}`, { method: "DELETE" }),
};

export const appointments = {
  list: ({ from, to, status, barberId } = {}) => apiFetch("/appointments", { query: { from, to, status, barberId } }),
  create: (data) => apiFetch("/appointments", { method: "POST", body: data }),
  cancel: (id, reason) => apiFetch(`/appointments/${id}/cancel`, { method: "PATCH", body: reason === undefined ? {} : { reason } }),
  complete: (id, paymentMethod) => apiFetch(`/appointments/${id}/complete`, { method: "PATCH", body: { paymentMethod } }),
  noShow: (id) => apiFetch(`/appointments/${id}/no-show`, { method: "PATCH", body: {} }),
};

export const users = {
  list: ({ role } = {}) => apiFetch("/users", { query: { role } }),
  create: (data) => apiFetch("/users", { method: "POST", body: data }),
  update: (id, data) => apiFetch(`/users/${id}`, { method: "PATCH", body: data }),
};
