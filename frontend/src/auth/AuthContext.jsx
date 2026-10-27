import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setUnauthorizedHandler } from "../api/client";
import { auth } from "../api/endpoints";

const TOKEN_KEY = "bt_token";
const EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

const AuthContext = createContext(null);

export function homeFor(role) {
  if (role === "BARBER") return "/agenda";
  if (role === "ADMIN") return "/admin/agenda";
  return "/agendar";
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));
  const [sessionMessage, setSessionMessage] = useState(null);

  const logout = useCallback(
    (reason) => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      if (reason === "expired") {
        setSessionMessage(EXPIRED_MESSAGE);
        navigate("/entrar");
      }
    },
    [navigate],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => logout("expired"));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    auth
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // 401 é tratado pelo handler de sessão expirada
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: loggedIn } = await auth.login({ email, password });
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedIn);
    setSessionMessage(null);
    return loggedIn;
  }, []);

  const register = useCallback(
    async (data) => {
      await auth.register(data);
      return login(data.email, data.password);
    },
    [login],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, sessionMessage }),
    [user, loading, login, register, logout, sessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
