import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchMe, loginUser, registerUser } from '../services/authService.js';
import { TOKEN_KEY } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const data = await fetchMe();
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => {
    const applySession = (newToken, newUser) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(newUser);
    };

    return {
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      async login(credentials) {
        const data = await loginUser(credentials);
        applySession(data.token, data.user);
        return data.user;
      },
      async register(payload) {
        const data = await registerUser(payload);
        applySession(data.token, data.user);
        return data.user;
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
    };
  }, [user, token, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
