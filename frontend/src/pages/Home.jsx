import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { services as servicesApi } from "../api/endpoints";
import { homeFor, useAuth } from "../auth/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import { formatPrice } from "../lib/money";
import "./Home.css";

export default function Home() {
  const { user } = useAuth();
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    servicesApi
      .list()
      .then((list) => !cancelled && setServices(list))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, []);

  const reserveTo = user ? homeFor(user.role) : "/entrar";

  return (
    <div className="home">
      <header className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-shade" />
        <div className="wrap hero-inner">
          <div className="hero-txt">
            <div className="kicker hero-kicker">Est. 1957</div>
            <h1>
              A cadeira está
              <br />
              <em>à sua espera.</em>
            </h1>
            <p className="lead">
              Corte na tesoura, barba na navalha e toalha quente. Escolha o barbeiro e o horário em menos de um minuto.
            </p>
            <div className="ctas">
              <Link className="btn solid" to={reserveTo}>Reservar cadeira</Link>
              <a className="btn" href="#servicos">Ver serviços</a>
            </div>
          </div>
        </div>
      </header>

      <div className="strip">
        <div className="wrap strip-grid">
          <div className="i"><b>Ter a Sáb</b>9h às 20h</div>
          <div className="i"><b>4 barbeiros</b>de mão firme</div>
          <div className="i"><b>Rua das Flores, 123</b>Centro</div>
        </div>
      </div>

      <section className="menu" id="servicos">
        <div className="wrap menu-grid">
          <div>
            <div className="kicker hero-kicker">A carta da casa</div>
            <h2>Serviços</h2>
            <ErrorMessage error={error} />
            {!services && !error && <p>Carregando serviços...</p>}
            {services && (
              <ul>
                {services.map((s) => (
                  <li key={s.id}>
                    <span>
                      {s.name}
                      <small>{s.description}</small>
                    </span>
                    <span className="dots" />
                    <span className="p">{formatPrice(s.priceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <figure className="frame">
            <img
              src="https://images.unsplash.com/photo-1629881544138-c45fc917eb81?w=900&q=75&auto=format&fm=jpg"
              alt="Cadeira de barbeiro antiga em couro vermelho"
            />
            <figcaption>A cadeira nº 1, restaurada em 1962.</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
