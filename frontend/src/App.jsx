import { Navigate, Route, Routes } from "react-router-dom";
import RequireRole from "./auth/RequireRole";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Booking from "./pages/client/Booking";
import MyAppointments from "./pages/client/MyAppointments";
import Agenda from "./pages/barber/Agenda";
import TimeOff from "./pages/barber/TimeOff";
import AdminAgenda from "./pages/admin/AdminAgenda";
import Services from "./pages/admin/Services";
import Users from "./pages/admin/Users";
import BusinessHours from "./pages/admin/BusinessHours";

function guard(roles, element) {
  return <RequireRole roles={roles}>{element}</RequireRole>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/agendar" element={guard(["CLIENT"], <Booking />)} />
        <Route path="/meus-agendamentos" element={guard(["CLIENT"], <MyAppointments />)} />
        <Route path="/agenda" element={guard(["BARBER"], <Agenda />)} />
        <Route path="/bloqueios" element={guard(["BARBER"], <TimeOff />)} />
        <Route path="/admin/agenda" element={guard(["ADMIN"], <AdminAgenda />)} />
        <Route path="/admin/servicos" element={guard(["ADMIN"], <Services />)} />
        <Route path="/admin/usuarios" element={guard(["ADMIN"], <Users />)} />
        <Route path="/admin/horarios" element={guard(["ADMIN"], <BusinessHours />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
