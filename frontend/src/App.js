import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onValue, ref, set, get } from 'firebase/database';
import { db, ensureAuth, PATHS } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { buildInitialTeams, DEFAULT_ADMIN_PASSWORD } from './data/initialTeams';

import BottomNav from './components/BottomNav';
import AppHeader from './components/Header';

import Teams from './pages/Teams';
import Standings from './pages/Standings';
import History from './pages/History';
import Login from './pages/Login';
import Admin from './pages/Admin';
import ScoreEntry from './pages/ScoreEntry';
import Rules from './pages/Rules';
import Schedule from './pages/Schedule';
import Matchups from './pages/Matchups';
import More from './pages/More';

function Shell() {
  const location = useLocation();
  const hideChrome = location.pathname === '/login';
  const [teams, setTeams] = useState({});
  const [matches, setMatches] = useState([]);
  const [adminConfig, setAdminConfig] = useState({ password: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ensureAuth();

    (async () => {
      try {
        await ensureAuth();
        const tSnap = await get(ref(db, PATHS.teams));
        if (!tSnap.exists()) {
          await set(ref(db, PATHS.teams), buildInitialTeams());
        } else {
          // Migration: backfill `group` for existing teams
          const existing = tSnap.val() || {};
          const updates = {};
          const sortedIds = Object.keys(existing).sort((a, b) => (existing[a].gradient || 0) - (existing[b].gradient || 0));
          sortedIds.forEach((tid, idx) => {
            if (!existing[tid].group) {
              updates[`${tid}/group`] = idx < 8 ? 'A' : 'B';
            }
          });
          if (Object.keys(updates).length > 0) {
            const { update } = await import('firebase/database');
            await update(ref(db, PATHS.teams), updates);
          }
        }
        const aSnap = await get(ref(db, PATHS.admin));
        if (!aSnap.exists()) {
          await set(ref(db, PATHS.admin), { password: DEFAULT_ADMIN_PASSWORD });
        }
      } catch (e) {
        console.error('Seed failed', e);
      }
    })();

    const unsubT = onValue(ref(db, PATHS.teams), (snap) => {
      setTeams(snap.val() || {});
      setLoaded(true);
    });
    const unsubM = onValue(ref(db, PATHS.matches), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, m]) => ({ id, ...m }));
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setMatches(list);
    });
    const unsubA = onValue(ref(db, PATHS.admin), (snap) => {
      setAdminConfig(snap.val() || { password: '' });
    });
    return () => { unsubT(); unsubM(); unsubA(); };
  }, []);

  return (
    <div className="app-shell">
      {!hideChrome && <AppHeader />}
      <Routes>
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/teams" element={<Teams teams={teams} loaded={loaded} />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/standings" element={<Standings teams={teams} matches={matches} />} />
        <Route path="/matchups" element={<Matchups matches={matches} teams={teams} />} />
        <Route path="/history" element={<History matches={matches} teams={teams} />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/more" element={<More />} />
        <Route path="/login" element={<Login teams={teams} adminConfig={adminConfig} />} />
        <Route path="/score" element={
          <ProtectedTeam>
            <ScoreEntry teams={teams} matches={matches} />
          </ProtectedTeam>
        } />
        <Route path="/admin" element={
          <ProtectedAdmin>
            <Admin teams={teams} adminConfig={adminConfig} matches={matches} />
          </ProtectedAdmin>
        } />
        <Route path="*" element={<Navigate to="/teams" replace />} />
      </Routes>
      {!hideChrome && <BottomNav />}
    </div>
  );
}

function ProtectedTeam({ children }) {
  const { session } = useAuth();
  if (session.role !== 'team' && session.role !== 'admin') {
    return <Navigate to="/login" replace state={{ next: '/score' }} />;
  }
  return children;
}

function ProtectedAdmin({ children }) {
  const { session } = useAuth();
  if (session.role !== 'admin') {
    return <Navigate to="/login" replace state={{ next: '/admin' }} />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
