import { createContext, useState, useEffect, useCallback } from "react";
import { getMe } from "../api/auth";

const AuthContext = createContext(null);
export { AuthContext }; // ← now after declaration

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("kb_token") || null,
  );
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("kb_user");
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(true);

  // Define logout first so useEffect can safely reference it
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("kb_token");
    localStorage.removeItem("kb_user");
  }, []);

  // On mount verify token is still valid
  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    getMe(token)
      .then((u) => {
        if (!cancelled) {
          setUser(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  function login(accessToken, userData) {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem("kb_token", accessToken);
    localStorage.setItem("kb_user", JSON.stringify(userData));
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
