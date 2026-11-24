import { useEffect, useState } from "react";
import { services as servicesApi } from "../../api/endpoints";
import ErrorMessage from "../../components/ErrorMessage";
import { centsToInput, formatPrice, parsePriceInput } from "../../lib/money";
import "../../styles/pages.css";

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);
const EMPTY = { name: "", description: "", price: "", durationMinutes: "30" };

export default function Services() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    servicesApi.list({ includeInactive: true }).then(setList).catch(setApiError);
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function startEdit(s) {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description ?? "", price: centsToInput(s.priceCents), durationMinutes: String(s.durationMinutes) });
    setFormError(null);
    setApiError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setFormError(null);
  }

  function replace(updated) {
    setList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setApiError(null);
    if (form.name.trim().length < 2) {
      setFormError("Informe o nome do serviço.");
      return;
    }
    const priceCents = parsePriceInput(form.price);
    if (priceCents === null) {
      setFormError("Informe um preço válido, por exemplo 45,00.");
      return;
    }
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceCents,
      durationMinutes: Number(form.durationMinutes),
    };
    setSubmitting(true);
    try {
      if (editingId) {
        replace(await servicesApi.update(editingId, body));
      } else {
        const created = await servicesApi.create(body);
        setList((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(s) {
    if (pendingId) return;
    setPendingId(s.id);
    setApiError(null);
    try {
      replace(s.active ? await servicesApi.remove(s.id) : await servicesApi.update(s.id, { active: true }));
    } catch (err) {
      setApiError(err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="page">
      <h1>Serviços</h1>
      <ErrorMessage error={apiError} />
      {list === null && !apiError && <p>Carregando...</p>}
      {list && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Duração</th>
                <th>Preço</th>
                <th>Ativo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.durationMinutes} min</td>
                  <td>{formatPrice(s.priceCents)}</td>
                  <td>{s.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn" onClick={() => startEdit(s)}>
                        Editar
                      </button>
                      <button type="button" className="btn" disabled={pendingId === s.id} onClick={() => toggleActive(s)}>
                        {s.active ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">{editingId ? "Editar serviço" : "Novo serviço"}</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <label className="field-group">
            Nome
            <input className="field" value={form.name} maxLength={100} onChange={update("name")} />
          </label>
          <label className="field-group">
            Descrição
            <input className="field" value={form.description} maxLength={500} onChange={update("description")} />
          </label>
          <label className="field-group">
            Preço
            <input className="field" inputMode="decimal" placeholder="45,00" value={form.price} onChange={update("price")} />
          </label>
          <label className="field-group">
            Duração
            <select className="field" value={form.durationMinutes} onChange={update("durationMinutes")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
        </div>
        {formError && <p role="alert" className="error">{formError}</p>}
        <div className="row-actions">
          <button type="submit" className="btn solid" disabled={submitting}>
            {editingId ? "Salvar alterações" : "Criar serviço"}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
