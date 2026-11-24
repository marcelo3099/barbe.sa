import { useCallback, useEffect, useState } from "react";
import { timeOff as timeOffApi } from "../../api/endpoints";
import ConflictList from "../../components/ConflictList";
import ErrorMessage from "../../components/ErrorMessage";
import { formatDate, formatTime, todayISODate } from "../../lib/datetime";
import "../../styles/pages.css";

const EMPTY = { date: "", start: "", end: "", reason: "" };

export default function TimeOff() {
  const [blocks, setBlocks] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(() => {
    return timeOffApi
      .list()
      .then((res) => {
        const now = new Date();
        setBlocks(res.filter((b) => new Date(b.endsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
      })
      .catch(setApiError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setApiError(null);
    if (!form.date || !form.start || !form.end) {
      setFormError("Preencha data, início e fim.");
      return;
    }
    if (form.end <= form.start) {
      setFormError("O fim precisa ser depois do início.");
      return;
    }
    const body = {
      startsAt: `${form.date}T${form.start}:00-03:00`,
      endsAt: `${form.date}T${form.end}:00-03:00`,
    };
    if (form.reason.trim()) body.reason = form.reason.trim();
    setSubmitting(true);
    try {
      await timeOffApi.create(body);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    if (removingId) return;
    setRemovingId(id);
    setApiError(null);
    try {
      await timeOffApi.remove(id);
      await load();
    } catch (err) {
      setApiError(err);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="page">
      <h1>Bloqueios</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <label className="field-group">
            Data
            <input className="field" type="date" min={todayISODate()} value={form.date} onChange={update("date")} />
          </label>
          <label className="field-group">
            Início
            <input className="field" type="time" step="900" value={form.start} onChange={update("start")} />
          </label>
          <label className="field-group">
            Fim
            <input className="field" type="time" step="900" value={form.end} onChange={update("end")} />
          </label>
          <label className="field-group">
            Motivo (opcional)
            <input className="field" type="text" maxLength={200} value={form.reason} onChange={update("reason")} />
          </label>
        </div>
        {formError && <p role="alert" className="error">{formError}</p>}
        <ErrorMessage error={apiError} />
        <ConflictList error={apiError} />
        <button className="btn solid" type="submit" disabled={submitting}>
          Bloquear horário
        </button>
      </form>

      <h2 className="section-title">Próximos bloqueios</h2>
      {blocks === null && !apiError && <p>Carregando...</p>}
      {blocks && blocks.length === 0 && <p className="empty">Nenhum bloqueio futuro.</p>}
      {blocks && blocks.length > 0 && (
        <div className="appt-list">
          {blocks.map((b) => (
            <article key={b.id} className="appt-card">
              <div className="appt-when">
                <span className="appt-date">{formatDate(b.startsAt)}</span>
                <span className="appt-time">
                  {formatTime(b.startsAt)}–{formatTime(b.endsAt)}
                </span>
              </div>
              <div className="appt-what">
                <span>{b.reason || "Sem motivo"}</span>
              </div>
              <div className="appt-meta">
                <button type="button" className="btn" disabled={removingId === b.id} onClick={() => handleRemove(b.id)}>
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
