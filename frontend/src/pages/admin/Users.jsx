import { useEffect, useState } from "react";
import { users as usersApi } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import ConflictList from "../../components/ConflictList";
import ErrorMessage from "../../components/ErrorMessage";
import FieldErrors from "../../components/FieldErrors";
import "../../styles/pages.css";

export const ROLE_LABELS = { CLIENT: "Cliente", BARBER: "Barbeiro", ADMIN: "Administrador" };
const ROLES = Object.entries(ROLE_LABELS);

const EMPTY_CREATE = { name: "", email: "", phone: "", password: "", role: "CLIENT" };

function RoleSelect({ value, onChange, disabled = false }) {
  return (
    <select className="field" value={value} disabled={disabled} onChange={onChange}>
      {ROLES.map(([role, label]) => (
        <option key={role} value={role}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [roleFilter, setRoleFilter] = useState("");
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(null); // { id, name, phone, role, active, password }
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    usersApi
      .list({ role: roleFilter || undefined })
      .then((res) => {
        if (!cancelled) setList(res);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [roleFilter]);

  const isSelf = editing && me && editing.id === me.id;

  function startEdit(u) {
    setEditing({ id: u.id, email: u.email, name: u.name, phone: u.phone ?? "", role: u.role, active: u.active, password: "" });
    setEditError(null);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);
    if (createForm.password.length < 8) {
      setCreateError({ message: "A senha precisa ter pelo menos 8 caracteres" });
      return;
    }
    const body = {
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      role: createForm.role,
    };
    if (createForm.phone.trim()) body.phone = createForm.phone.trim();
    setCreating(true);
    try {
      const created = await usersApi.create(body);
      if (!roleFilter || roleFilter === created.role) setList((prev) => [...(prev ?? []), created]);
      setCreateForm(EMPTY_CREATE);
    } catch (err) {
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setEditError(null);
    if (editing.password && editing.password.length < 8) {
      setEditError({ message: "A senha precisa ter pelo menos 8 caracteres" });
      return;
    }
    const body = { name: editing.name.trim(), phone: editing.phone.trim() || null };
    if (!isSelf) {
      body.role = editing.role;
      body.active = editing.active;
    }
    if (editing.password) body.password = editing.password;
    setSaving(true);
    try {
      const updated = await usersApi.update(editing.id, body);
      setList((prev) =>
        prev
          .map((u) => (u.id === updated.id ? updated : u))
          .filter((u) => !roleFilter || u.role === roleFilter),
      );
      setEditing(null);
    } catch (err) {
      setEditError(err);
    } finally {
      setSaving(false);
    }
  }

  const setCreate = (field) => (e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }));
  const setEdit = (field) => (e) =>
    setEditing((f) => ({ ...f, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="page">
      <h1>Usuários</h1>
      <div className="toolbar">
        <label className="field-group">
          Filtrar por perfil
          <select className="field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Todos</option>
            {ROLES.map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorMessage error={loadError} />
      {list === null && !loadError && <p>Carregando...</p>}
      {list && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Ativo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td>{u.active ? "Sim" : "Não"}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => startEdit(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <form aria-label="Editar usuário" className="dialog" onSubmit={handleSave} noValidate>
          <h2 className="section-title">Editar {editing.email}</h2>
          <div className="form-grid">
            <label className="field-group">
              Nome
              <input className="field" value={editing.name} onChange={setEdit("name")} />
            </label>
            <label className="field-group">
              Telefone
              <input className="field" inputMode="numeric" value={editing.phone} onChange={setEdit("phone")} />
            </label>
            <label className="field-group">
              Perfil
              <RoleSelect value={editing.role} disabled={isSelf} onChange={setEdit("role")} />
            </label>
            <label className="field-group">
              Nova senha (opcional)
              <input className="field" type="password" autoComplete="new-password" value={editing.password} onChange={setEdit("password")} />
            </label>
            <label>
              <input type="checkbox" checked={editing.active} disabled={isSelf} onChange={setEdit("active")} /> Ativo
            </label>
          </div>
          {isSelf && <p className="empty">Você não pode desativar nem mudar o próprio perfil.</p>}
          <ErrorMessage error={editError} />
          <FieldErrors error={editError} />
          <ConflictList error={editError} showDate />
          <div className="row-actions">
            <button type="submit" className="btn solid" disabled={saving}>
              Salvar alterações
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancelar edição
            </button>
          </div>
        </form>
      )}

      <h2 className="section-title">Novo usuário</h2>
      <form aria-label="Novo usuário" onSubmit={handleCreate} noValidate>
        <div className="form-grid">
          <label className="field-group">
            Nome
            <input className="field" value={createForm.name} onChange={setCreate("name")} />
          </label>
          <label className="field-group">
            E-mail
            <input className="field" type="email" value={createForm.email} onChange={setCreate("email")} />
          </label>
          <label className="field-group">
            Telefone (opcional)
            <input className="field" inputMode="numeric" value={createForm.phone} onChange={setCreate("phone")} />
          </label>
          <label className="field-group">
            Senha
            <input className="field" type="password" autoComplete="new-password" value={createForm.password} onChange={setCreate("password")} />
          </label>
          <label className="field-group">
            Perfil
            <RoleSelect value={createForm.role} onChange={setCreate("role")} />
          </label>
        </div>
        <ErrorMessage error={createError} />
        <FieldErrors error={createError} />
        <button type="submit" className="btn solid" disabled={creating}>
          Criar usuário
        </button>
      </form>
    </div>
  );
}
