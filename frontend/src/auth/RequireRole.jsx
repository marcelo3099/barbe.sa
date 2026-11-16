import { Navigate } from "react-router-dom";
import { homeFor, useAuth } from "./AuthContext";

export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Carregando...</p>;
  if (!user) return <Navigate to="/entrar" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
