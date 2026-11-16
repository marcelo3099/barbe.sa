export const clientUser = { id: 5, name: "Ana", email: "ana@x.com", phone: "48999990000", role: "CLIENT", active: true };
export const barberUser = { id: 2, name: "Seu Jorge", email: "jorge@x.com", phone: "48999991111", role: "BARBER", active: true };
export const adminUser = { id: 1, name: "Marcelo", email: "admin@x.com", phone: "48999992222", role: "ADMIN", active: true };

export const services = [
  { id: 1, name: "Corte clássico", description: "Tesoura e máquina", priceCents: 4500, durationMinutes: 30, active: true },
  { id: 2, name: "Barba", description: "Toalha quente e navalha", priceCents: 3500, durationMinutes: 30, active: true },
];

export const barbers = [{ id: 2, name: "Seu Jorge" }];

export function appointment(overrides = {}) {
  return {
    id: 10,
    status: "SCHEDULED",
    startsAt: "2026-11-03T09:00:00-03:00",
    endsAt: "2026-11-03T09:30:00-03:00",
    priceCents: 4500,
    paymentMethod: null,
    paidAt: null,
    canceledAt: null,
    cancelReason: null,
    client: { id: 5, name: "Ana", phone: "48999990000" },
    barber: { id: 2, name: "Seu Jorge" },
    service: { id: 1, name: "Corte clássico", durationMinutes: 30 },
    ...overrides,
  };
}
