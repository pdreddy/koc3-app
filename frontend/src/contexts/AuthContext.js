import React, { createContext, useContext, useEffect, useState } from 'react';
import { ROLES, normalizeRole } from '../utils/roles';
import { signOutPlayerAuth } from '../services/playerAccount';

const AuthContext = createContext(null);
const STORAGE_KEY = 'koc_session_v1';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...JSON.parse(raw), role: normalizeRole(JSON.parse(raw).role) } : { role: ROLES.GUEST };
    } catch {
      return { role: ROLES.GUEST };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }, [session]);

  const loginAdmin = (role = ROLES.SUPER_ADMIN, user = {}) => setSession({ role, userId: user.username || user.userId || role, name: user.name || user.username || role, loginAt: Date.now() });
  const loginTeam = (teamId, teamName) => setSession({ role: ROLES.CAPTAIN, teamId, teamName, loginAt: Date.now() });
  const loginPlayer = (player = {}) => setSession({
    role: ROLES.PLAYER,
    playerId: player.id || player.playerId,
    name: player.name,
    email: player.email,
    teamId: player.teamId || '',
    authUid: player.authUid || '',
    loginAt: Date.now()
  });
  const refreshTeamSession = (teamId, teamName) => setSession(prev => (prev.role === ROLES.CAPTAIN && prev.teamId === teamId && prev.teamName !== teamName) ? { ...prev, teamName } : prev);
  const logout = () => {
    setSession(prev => {
      if (normalizeRole(prev?.role) === ROLES.PLAYER) {
        // Sign out of Firebase Auth; the auth watcher restores anonymous access.
        signOutPlayerAuth().catch(() => {});
      }
      return { role: ROLES.GUEST };
    });
  };

  return (
    <AuthContext.Provider value={{ session, loginAdmin, loginTeam, loginPlayer, refreshTeamSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
