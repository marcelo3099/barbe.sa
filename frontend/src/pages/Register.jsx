import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../auth/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import "./Auth.css";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [clientError, setClientError] = useState(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setClientError(null);
    if (password.length < 8) {
      setClientError("A senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setPending(true);
    try {
      const created = await register({ name, email, password, phone: phone || undefined });
      navigate(homeFor(created.role));
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const emailErrors = error?.details?.email;

  return (
    <div className="auth">
      <form className="ficha" onSubmit={handleSubmit}>
        <h1>Cadastro</h1>
        <ErrorMessage error={error} />
        {clientError && (
          <p role="alert" className="error">
            {clientError}
          </p>
        )}
        <label className="field-group">
          Nome
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="field-group">
          <label htmlFor="register-email">E-mail</label>
          <input
            id="register-email"
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={emailErrors ? "email-error" : undefined}
            required
          />
          {emailErrors && (
            <span id="email-error" role="alert" className="field-error">
              {emailErrors[0]}
            </span>
          )}
        </div>
        <label className="field-group">
          Telefone (opcional)
          <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
          Criar conta
        </button>
      </form>
    </div>
  );
}
