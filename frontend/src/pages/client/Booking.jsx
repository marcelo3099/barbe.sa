import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appointments, availability as availabilityApi, barbers as barbersApi, services as servicesApi, users as usersApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import ErrorMessage from "../../components/ErrorMessage";
import { formatTime, todayISODate } from "../../lib/datetime";
import { formatPrice } from "../../lib/money";
import "./Booking.css";

const MAX_DAYS_AHEAD = 60;

export default function Booking({ forStaff = false }) {
  const { user } = useAuth();
  const barberFixed = forStaff && user?.role === "BARBER";
  const showClientPicker = forStaff;
  const isAdminPicker = forStaff && user?.role === "ADMIN";

  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState("");
  const [servicesList, setServicesList] = useState(null);
  const [barbersList, setBarbersList] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [barberId, setBarberId] = useState(barberFixed ? user.id : null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState(null);
  const [slotsReload, setSlotsReload] = useState(0);
  const [startsAt, setStartsAt] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState(null);

  useEffect(() => {
    servicesApi.list().then(setServicesList).catch(setLoadError);
    if (!barberFixed) {
      barbersApi.list().then(setBarbersList).catch(setLoadError);
    }
  }, [barberFixed]);

  useEffect(() => {
    if (isAdminPicker) {
      usersApi.list({ role: "CLIENT" }).then(setClients).catch(setLoadError);
    }
  }, [isAdminPicker]);

  const clientReady = !showClientPicker || (isAdminPicker ? clientId !== "" : String(clientId).trim() !== "");

  useEffect(() => {
    if (!serviceId || !barberId || !date) {
      setSlots(null);
      return undefined;
    }
    let cancelled = false;
    setSlotsError(null);
    availabilityApi
      .get({ barberId, serviceId, date })
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .catch((err) => {
        if (!cancelled) setSlotsError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, barberId, date, slotsReload]);

  function chooseService(id) {
    setServiceId(id);
    setStartsAt(null);
  }

  function chooseBarber(id) {
    setBarberId(id);
    setStartsAt(null);
  }

  function chooseDate(value) {
    setDate(value);
    setStartsAt(null);
  }

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = { serviceId, barberId, startsAt };
      if (showClientPicker) body.clientId = Number(clientId);
      const created = await appointments.create(body);
      setConfirmedId(created.id);
    } catch (err) {
      if (err.code === "SLOT_UNAVAILABLE") {
        setStartsAt(null);
        setSlotsReload((n) => n + 1);
      }
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedId) {
    return (
      <div className="booking-confirmed">
        <p role="status">Agendamento confirmado</p>
        <Link to="/meus-agendamentos">Meus agendamentos</Link>
      </div>
    );
  }

  const stepNumber = (n) => (barberFixed ? n - 1 : n);
  const selectedService = servicesList?.find((s) => s.id === serviceId);
  const selectedBarberName = barberFixed ? user.name : barbersList?.find((b) => b.id === barberId)?.name;

  return (
    <div className="booking">
      <h1>Agendar horário</h1>
      <ErrorMessage error={loadError} />
      <ErrorMessage error={submitError} />

      {showClientPicker && (
        <section className="step">
          <h2>0. Cliente</h2>
          {isAdminPicker ? (
            <select className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione o cliente</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <label className="field-group">
              ID do cliente
              <input
                className="field"
                type="number"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </label>
          )}
        </section>
      )}

      {clientReady && (
        <section className="step">
          <h2>{stepNumber(1)}. Serviço</h2>
          <div className="cards">
            {(servicesList ?? []).filter((s) => s.active).map((s) => (
              <button
                key={s.id}
                type="button"
                className={`card-option ${serviceId === s.id ? "selected" : ""}`}
                onClick={() => chooseService(s.id)}
              >
                <strong>{s.name}</strong>
                <span>{s.durationMinutes} min</span>
                <span>{formatPrice(s.priceCents)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {clientReady && serviceId && !barberFixed && (
        <section className="step">
          <h2>{stepNumber(2)}. Barbeiro</h2>
          <div className="cards">
            {(barbersList ?? []).map((b) => (
              <button
                key={b.id}
                type="button"
                className={`card-option ${barberId === b.id ? "selected" : ""}`}
                onClick={() => chooseBarber(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {clientReady && serviceId && barberId && (
        <section className="step">
          <h2>{stepNumber(3)}. Data</h2>
          <input
            className="field"
            type="date"
            value={date}
            min={todayISODate()}
            max={todayISODate(new Date(Date.now() + MAX_DAYS_AHEAD * 86400000))}
            onChange={(e) => chooseDate(e.target.value)}
          />
        </section>
      )}

      {clientReady && serviceId && barberId && date && (
        <section className="step">
          <h2>{stepNumber(4)}. Horário</h2>
          <ErrorMessage error={slotsError} />
          {slots === null && !slotsError && <p>Carregando horários...</p>}
          {slots && slots.length === 0 && <p>Nenhum horário livre neste dia.</p>}
          {slots && slots.length > 0 && (
            <div className="slots">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`slot ${startsAt === slot ? "selected" : ""}`}
                  onClick={() => setStartsAt(slot)}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {clientReady && serviceId && barberId && date && startsAt && (
        <section className="step">
          <h2>{stepNumber(5)}. Confirmar</h2>
          <p>
            {selectedService?.name} com {selectedBarberName} em {date} às {formatTime(startsAt)}
          </p>
          <button className="btn solid" type="button" disabled={submitting} onClick={handleConfirm}>
            Confirmar agendamento
          </button>
        </section>
      )}
    </div>
  );
}
