import { useState } from "react";
import Agenda from "../barber/Agenda";
import Booking from "../client/Booking";
import "../../styles/pages.css";

const TABS = [
  ["agenda", "Agenda"],
  ["novo", "Novo agendamento"],
];

export default function AdminAgenda() {
  const [tab, setTab] = useState("agenda");
  return (
    <div className="page">
      <h1>Agenda geral</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "agenda" ? <Agenda barberFilter /> : <Booking forStaff />}</div>
    </div>
  );
}
