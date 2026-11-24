import { useEffect, useState } from "react";
import { appointments as appointmentsApi } from "../../api/endpoints";
import AppointmentCard from "../../components/AppointmentCard";
import ErrorMessage from "../../components/ErrorMessage";
import "../../styles/pages.css";

const TWO_HOURS = 2 * 3600 * 1000;

export function canClientCancel(appointment, now = new Date()) {
  return appointment.status === "SCHEDULED" && new Date(appointment.startsAt) - now >= TWO_HOURS;
}

export default function MyAppointments() {
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    appointmentsApi.list().then(setList).catch(setLoadError);
  }, []);

  async function handleCancel(id) {
    if (pendingId) return;
    setPendingId(id);
    setActionError(null);
    try {
      const updated = await appointmentsApi.cancel(id);
      setList((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setConfirmingId(null);
    } catch (err) {
      setActionError(err);
    } finally {
      setPendingId(null);
    }
  }

  const now = new Date();
  const upcoming = (list ?? []).filter((a) => a.status === "SCHEDULED" && new Date(a.startsAt) >= now);
  const history = (list ?? [])
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

  function actionsFor(a) {
    if (!canClientCancel(a, now)) return null;
    if (confirmingId === a.id) {
      return (
        <>
          <span>Cancelar este horário?</span>
          <button type="button" className="btn solid" disabled={pendingId === a.id} onClick={() => handleCancel(a.id)}>
            Sim, cancelar
          </button>
          <button type="button" className="btn" disabled={pendingId === a.id} onClick={() => setConfirmingId(null)}>
            Voltar
          </button>
        </>
      );
    }
    return (
      <button type="button" className="btn" onClick={() => setConfirmingId(a.id)}>
        Cancelar
      </button>
    );
  }

  return (
    <div className="page">
      <h1>Meus agendamentos</h1>
      <ErrorMessage error={loadError} />
      <ErrorMessage error={actionError} />
      {list === null && !loadError && <p>Carregando...</p>}
      {list && (
        <>
          <section aria-labelledby="sec-upcoming">
            <h2 id="sec-upcoming" className="section-title">Próximos</h2>
            {upcoming.length === 0 ? (
              <p className="empty">Nenhum agendamento futuro.</p>
            ) : (
              <div className="appt-list">
                {upcoming.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} actions={actionsFor(a)} />
                ))}
              </div>
            )}
          </section>
          <section aria-labelledby="sec-history">
            <h2 id="sec-history" className="section-title">Histórico</h2>
            {history.length === 0 ? (
              <p className="empty">Nada por aqui ainda.</p>
            ) : (
              <div className="appt-list">
                {history.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
