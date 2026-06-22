import React, { createContext, useContext, useEffect, useState } from 'react';
import { can as canPerm, roleOf } from '../config/roles';

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

  // user: { username, name, role } where role is SUPER_ADMIN | ADMIN
  const loginAdmin = (user) => setSession({
    role: 'admin',
    adminRole: user.role,
    adminName: user.name,
    username: user.username,
    loginAt: Date.now()
  });
  const loginTeam = (teamId, teamName) => setSession({ role: 'team', teamId, teamName, loginAt: Date.now() });
  const logout = () => setSession({ role: 'guest' });

  const value = {
    session,
    loginAdmin,
    loginTeam,
    logout,
    role: roleOf(session),
    can: (permission) => canPerm(session, permission)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
