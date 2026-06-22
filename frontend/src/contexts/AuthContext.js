import React, { createContext, useContext, useEffect, useState } from 'react';
import { logAuditEvent } from '../utils/auditLog';
import { ROLES, normalizeRole } from '../utils/roles';

const AuthContext = createContext(null);
const STORAGE_KEY = 'koc_session_v1';

function normalizeSession(session) {
  if (!session || !session.role) return { role: ROLES.GUEST };
  return { ...session, role: normalizeRole(session.role) };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeSession(raw ? JSON.parse(raw) : { role: ROLES.GUEST });
    } catch {
      return { role: ROLES.GUEST };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }, [session]);

  const loginAdmin = (role = ROLES.ADMIN) => {
    const next = { role: normalizeRole(role), userId: normalizeRole(role), loginAt: Date.now() };
    setSession(next);
    logAuditEvent({ actionType: 'LOGIN', session: next, targetType: 'auth', targetId: next.userId });
  };
  const loginTeam = (teamId, teamName) => {
    const next = { role: ROLES.CAPTAIN, userId: teamId, teamId, teamName, loginAt: Date.now() };
    setSession(next);
    logAuditEvent({ actionType: 'LOGIN', session: next, targetType: 'team', targetId: teamId });
  };
  const logout = () => {
    logAuditEvent({ actionType: 'LOGOUT', session, targetType: 'auth', targetId: session.userId || session.teamId || session.role });
    setSession({ role: ROLES.GUEST });
  };

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
