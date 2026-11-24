import { useEffect, useState } from "react";
import { businessHours as businessHoursApi } from "../../api/endpoints";
import ConflictList from "../../components/ConflictList";
import ErrorMessage from "../../components/ErrorMessage";
import "../../styles/pages.css";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function toForm(row) {
  return { ...row, breakStartsAt: row.breakStartsAt ?? "", breakEndsAt: row.breakEndsAt ?? "" };
}

// Valida uma linha aberta; devolve a mensagem de erro ou null.
export function validateRow(row) {
  if (row.closed) return null;
  if (!row.opensAt || !row.closesAt) return "Informe a abertura e o fechamento.";
  if (!(row.opensAt < row.closesAt)) return "A abertura precisa ser antes do fechamento.";
  const hasStart = row.breakStartsAt !== "";
  const hasEnd = row.breakEndsAt !== "";
  if (hasStart !== hasEnd) return "Informe o início e o fim do intervalo, ou nenhum dos dois.";
  if (hasStart && !(row.opensAt <= row.breakStartsAt && row.breakStartsAt < row.breakEndsAt && row.breakEndsAt <= row.closesAt)) {
    return "O intervalo precisa estar dentro do expediente.";
  }
  return null;
}

export default function BusinessHours() {
  const [original, setOriginal] = useState(null);
  const [rows, setRows] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    businessHoursApi
      .get()
      .then((res) => {
        const sorted = [...res].sort((a, b) => a.weekday - b.weekday);
        setOriginal(sorted);
        setRows(sorted.map(toForm));
      })
      .catch(setApiError);
  }, []);

  function update(weekday, field, value) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, [field]: value } : r)));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaved(false);
    setApiError(null);
    const errors = {};
    rows.forEach((r) => {
      const msg = validateRow(r);
      if (msg) errors[r.weekday] = msg;
    });
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const body = rows.map((r) => {
      if (r.closed) {
        const o = original.find((x) => x.weekday === r.weekday);
        return { ...o, closed: true };
      }
      return {
        weekday: r.weekday,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        breakStartsAt: r.breakStartsAt || null,
        breakEndsAt: r.breakEndsAt || null,
        closed: false,
      };
    });
    setSaving(true);
    try {
      const res = await businessHoursApi.put(body);
      const sorted = [...res].sort((a, b) => a.weekday - b.weekday);
      setOriginal(sorted);
      setRows(sorted.map(toForm));
      setSaved(true);
    } catch (err) {
      setApiError(err);
    } finally {
      setSaving(false);
    }
  }

  function timeInput(r, field, label) {
    const day = WEEKDAYS[r.weekday];
    return (
      <input
        className="field"
        type="time"
        step="900"
        aria-label={`${label} (${day})`}
        value={r[field]}
        disabled={r.closed}
        onChange={(e) => update(r.weekday, field, e.target.value)}
      />
    );
  }

  return (
    <div className="page">
      <h1>Horário de funcionamento</h1>
      {!rows && <ErrorMessage error={apiError} />}
      {!rows && !apiError && <p>Carregando...</p>}
      {rows && (
        <form onSubmit={handleSave} noValidate>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Fechado</th>
                  <th>Abre</th>
                  <th>Fecha</th>
                  <th>Intervalo de</th>
                  <th>Até</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.weekday}>
                    <th scope="row">{WEEKDAYS[r.weekday]}</th>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Fechado (${WEEKDAYS[r.weekday]})`}
                        checked={r.closed}
                        onChange={(e) => update(r.weekday, "closed", e.target.checked)}
                      />
                    </td>
                    <td>{timeInput(r, "opensAt", "Abre")}</td>
                    <td>{timeInput(r, "closesAt", "Fecha")}</td>
                    <td>{timeInput(r, "breakStartsAt", "Intervalo de")}</td>
                    <td>{timeInput(r, "breakEndsAt", "Até")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(rowErrors).length > 0 && (
            <ul className="error" role="alert">
              {Object.entries(rowErrors).map(([weekday, msg]) => (
                <li key={weekday}>
                  <strong>{WEEKDAYS[weekday]}:</strong> <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}
          <ErrorMessage error={apiError} />
          <ConflictList error={apiError} showDate />
          {saved && <p role="status">Horários salvos.</p>}
          <button type="submit" className="btn solid" disabled={saving}>
            Salvar horários
          </button>
        </form>
      )}
    </div>
  );
}
