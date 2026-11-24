import { useEffect, useState } from "react";
import { appointments as appointmentsApi, barbers as barbersApi } from "../../api/endpoints";
import AppointmentCard from "../../components/AppointmentCard";
import CompleteDialog from "../../components/CompleteDialog";
import ErrorMessage from "../../components/ErrorMessage";
import { formatDate, todayISODate } from "../../lib/datetime";
import Booking from "../client/Booking";
import "../../styles/pages.css";

const DAY = 24 * 3600 * 1000;
const NOT_YET = "Disponível a partir do horário marcado";

export function canFinish(appointment, now = new Date()) {
  return appointment.status === "SCHEDULED" && now >= new Date(appointment.startsAt);
}

function shiftDate(date, days) {
  return todayISODate(new Date(new Date(`${date}T12:00:00-03:00`).getTime() + days * DAY));
}

// Rota /agenda do barbeiro: agenda do dia + atalho "Novo agendamento" (Booking com "ID do cliente").
export default function BarberAgenda({ barberFilter = false }) {
  const [booking, setBooking] = useState(false);
  if (barberFilter) return <DayAgenda barberFilter />;
  return (
    <div className="page">
      <h1>Minha agenda</h1>
      <div className="toolbar">
        <button type="button" className="btn solid" onClick={() => setBooking((b) => !b)}>
          {booking ? "Voltar para a agenda" : "Novo agendamento"}
        </button>
      </div>
      {booking ? <Booking forStaff /> : <DayAgenda />}
    </div>
  );
}

function DayAgenda({ barberFilter = false }) {
  const [date, setDate] = useState(() => todayISODate());
  const [barberId, setBarberId] = useState("");
  const [barbersList, setBarbersList] = useState([]);
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [open, setOpen] = useState(null); // { id, kind: "complete" | "cancel" }
  const [pendingId, setPendingId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // reavalia "Concluir"/"Faltou" com o passar do tempo, sem precisar recarregar a página
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (barberFilter) barbersApi.list().then(setBarbersList).catch(setLoadError);
  }, [barberFilter]);

  useEffect(() => {
    let cancelled = false;
    setList(null);
    setLoadError(null);
    appointmentsApi
      .list({ from: date, to: date, barberId: barberId || undefined })
      .then((res) => {
        if (!cancelled) setList([...res].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [date, barberId]);

  async function run(id, action) {
    if (pendingId) return;
    setPendingId(id);
    setActionError(null);
    try {
      const updated = await action();
      setList((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setOpen(null);
    } catch (err) {
      setActionError(err);
    } finally {
      setPendingId(null);
    }
  }

  function actionsFor(a) {
    if (a.status !== "SCHEDULED") return null;
    const finishable = canFinish(a, now);
    const busy = pendingId === a.id;
    if (open?.id === a.id && open.kind === "complete") {
      return (
        <CompleteDialog
          pending={busy}
          onClose={() => setOpen(null)}
          onConfirm={(method) => run(a.id, () => appointmentsApi.complete(a.id, method))}
        />
      );
    }
    if (open?.id === a.id && open.kind === "noShow") {
      return (
        <>
          <span>Marcar que o cliente faltou?</span>
          <button type="button" className="btn solid" disabled={busy} onClick={() => run(a.id, () => appointmentsApi.noShow(a.id))}>
            Sim, marcar falta
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setOpen(null)}>
            Voltar
          </button>
        </>
      );
    }
    if (open?.id === a.id && open.kind === "cancel") {
      return (
        <>
          <span>Cancelar este horário?</span>
          <button type="button" className="btn solid" disabled={busy} onClick={() => run(a.id, () => appointmentsApi.cancel(a.id))}>
            Sim, cancelar
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setOpen(null)}>
            Voltar
          </button>
        </>
      );
    }
    return (
      <>
        <button
          type="button"
          className="btn solid"
          disabled={!finishable || busy}
          title={finishable ? undefined : NOT_YET}
          onClick={() => setOpen({ id: a.id, kind: "complete" })}
        >
          Concluir
        </button>
        <button
          type="button"
          className="btn"
          disabled={!finishable || busy}
          title={finishable ? undefined : NOT_YET}
          onClick={() => setOpen({ id: a.id, kind: "noShow" })}
        >
          Faltou
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setOpen({ id: a.id, kind: "cancel" })}>
          Cancelar
        </button>
      </>
    );
  }

  return (
    <div className="agenda">
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setDate((d) => shiftDate(d, -1))}>
          ◀ Dia anterior
        </button>
        <span className="current-day">{formatDate(`${date}T12:00:00-03:00`)}</span>
        <button type="button" className="btn" onClick={() => setDate((d) => shiftDate(d, 1))}>
          Próximo dia ▶
        </button>
        <button type="button" className="btn" onClick={() => setDate(todayISODate())}>
          Hoje
        </button>
        {barberFilter && (
          <label className="field-group">
            Barbeiro
            <select className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Todos</option>
              {barbersList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <ErrorMessage error={loadError} />
      <ErrorMessage error={actionError} />
      {list === null && !loadError && <p>Carregando...</p>}
      {list && list.length === 0 && <p className="empty">Nenhum agendamento neste dia.</p>}
      {list && list.length > 0 && (
        <div className="appt-list">
          {list.map((a) => (
            <AppointmentCard key={a.id} appointment={a} showClient actions={actionsFor(a)} />
          ))}
        </div>
      )}
    </div>
  );
}
