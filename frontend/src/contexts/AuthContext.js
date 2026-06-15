import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'koc_session_v1';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { role: 'guest' };
    } catch {
      return { role: 'guest' };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }, [session]);

  const loginAdmin = () => setSession({ role: 'admin', loginAt: Date.now() });
  const loginTeam = (teamId, teamName) => setSession({ role: 'team', teamId, teamName, loginAt: Date.now() });
  const logout = () => setSession({ role: 'guest' });

  return (
    <AuthContext.Provider value={{ session, loginAdmin, loginTeam, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
