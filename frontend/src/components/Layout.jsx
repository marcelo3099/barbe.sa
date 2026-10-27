import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const LINKS = {
  CLIENT: [
    ["/agendar", "Agendar"],
    ["/meus-agendamentos", "Meus agendamentos"],
  ],
  BARBER: [
    ["/agenda", "Agenda"],
    ["/bloqueios", "Bloqueios"],
  ],
  ADMIN: [
    ["/admin/agenda", "Agenda"],
    ["/admin/servicos", "Serviços"],
    ["/admin/usuarios", "Usuários"],
    ["/admin/horarios", "Horários"],
  ],
};

export default function Layout({ className = "" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? LINKS[user.role] ?? [] : [["/#servicos", "Serviços"]];

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <>
      <header className={`topbar ${className}`.trim()}>
        <Link to="/" className="logo">Barber Time</Link>
        <nav className="nav">
          {links.map(([to, label]) => (
            <Link key={to} to={to}>{label}</Link>
          ))}
          {user ? (
            <button type="button" className="nav-link" onClick={handleLogout}>Sair</button>
          ) : (
            <Link to="/entrar">Entrar</Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
