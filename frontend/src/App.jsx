import { Link } from "react-router-dom";

export default function App() {
  return (
    <header className="topbar">
      <Link to="/" className="logo">Barber Time</Link>
      <nav>
        <Link to="/entrar">Entrar</Link>
      </nav>
    </header>
  );
}
