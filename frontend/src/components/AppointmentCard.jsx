import { formatDate, formatTime } from "../lib/datetime";
import { formatPrice } from "../lib/money";

export const STATUS_LABELS = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export default function AppointmentCard({ appointment, actions = null, showClient = false }) {
  const { startsAt, service, barber, client, priceCents, status } = appointment;
  return (
    <article className={`appt-card status-${status.toLowerCase()}`}>
      <div className="appt-when">
        <span className="appt-date">{formatDate(startsAt)}</span>
        <span className="appt-time">{formatTime(startsAt)}</span>
      </div>
      <div className="appt-what">
        <strong>{service.name}</strong>
        <span>{showClient ? client.name : barber.name}</span>
      </div>
      <div className="appt-meta">
        <span>{formatPrice(priceCents)}</span>
        <span className="appt-status">{STATUS_LABELS[status] ?? status}</span>
      </div>
      {actions && <div className="appt-actions">{actions}</div>}
    </article>
  );
}
