import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../auth/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import "./Auth.css";

export default function Login() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const loggedIn = await login(email, password);
      navigate(homeFor(loggedIn.role));
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <form className="ficha" onSubmit={handleSubmit}>
        <h1>Entrar</h1>
        {sessionMessage && (
          <p role="alert" className="error">
            {sessionMessage}
          </p>
        )}
        <ErrorMessage error={error} />
        <label className="field-group">
          E-mail
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field-group">
          Senha
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn solid" type="submit" disabled={pending}>
          Entrar
        </button>
        <p className="hint">
          Não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
