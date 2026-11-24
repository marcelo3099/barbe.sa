import { formatDate, formatTime } from "../lib/datetime";

// Mostra os agendamentos que vieram em error.details de um 409 CONFLICTING_APPOINTMENTS.
export default function ConflictList({ error, showDate = false }) {
  if (error?.code !== "CONFLICTING_APPOINTMENTS" || !Array.isArray(error.details) || error.details.length === 0) {
    return null;
  }
  return (
    <ul className="conflicts" aria-label="Agendamentos em conflito">
      {error.details.map((a) => (
        <li key={a.id}>
          {showDate ? `${formatDate(a.startsAt)} ` : ""}
          {`${formatTime(a.startsAt)} · ${a.client?.name ?? ""} · ${a.service?.name ?? ""}`}
        </li>
      ))}
    </ul>
  );
}
