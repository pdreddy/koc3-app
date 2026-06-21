import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onValue, ref, set, get } from 'firebase/database';
import { db, ensureAuth, PATHS } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { buildInitialTeams, DEFAULT_ADMIN_PASSWORD } from './data/initialTeams';
import { buildUtrRatingsTable } from './data/utrRatings';
import { buildScheduleFor8x2, firstSundayOnOrAfter } from './utils/roundRobin';

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
import Season2 from './pages/Season2';
import PtlRatings from './pages/PtlRatings';

function firebaseObjectToList(data, source) {
  if (!data) return [];
  const node = data.matches || data.matchResults || data.results || data;
  if (Array.isArray(node)) {
    return node.filter(Boolean).map((m, idx) => ({ id: m.id || `${source}-${idx}`, source, ...m }));
  }
  if (typeof node === 'object') {
    const direct = Object.entries(node).map(([id, m]) => ({ id, source, ...(m || {}) }));
    const hasMatchShape = direct.some(m => m.lines || m.t1 || m.t2 || m.t1Id || m.t2Id || m.winnerId || m.win);
    if (hasMatchShape) return direct;
    return Object.entries(node).flatMap(([groupId, child]) =>
      firebaseObjectToList(child, source).map(m => ({ ...m, id: `${groupId}-${m.id}` }))
    );
  }
  return [];
}

function Shell() {
  const location = useLocation();
  const hideChrome = location.pathname === '/login';
  const [teams, setTeams] = useState({});
  const [matches, setMatches] = useState([]);
  const [legacyMatches, setLegacyMatches] = useState([]);
  const [legacyFallbackMatches, setLegacyFallbackMatches] = useState([]);
  const [playerRatings, setPlayerRatings] = useState({});
  const [adminConfig, setAdminConfig] = useState({ password: '' });
  const [schedule, setSchedule] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ensureAuth();

    (async () => {
      try {
        await ensureAuth();
        const tSnap = await get(ref(db, PATHS.teams));
        let teamsData;
        if (!tSnap.exists()) {
          teamsData = buildInitialTeams();
          await set(ref(db, PATHS.teams), teamsData);
        } else {
          teamsData = tSnap.val() || {};
          // Migration: backfill `group` for existing teams
          const updates = {};
          const sortedIds = Object.keys(teamsData).sort((a, b) => (teamsData[a].gradient || 0) - (teamsData[b].gradient || 0));
          sortedIds.forEach((tid, idx) => {
            if (!teamsData[tid].group) {
              const g = idx < 8 ? 'A' : 'B';
              updates[`${tid}/group`] = g;
              teamsData[tid].group = g;
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

        const rSnap = await get(ref(db, PATHS.playerRatings));
        if (!rSnap.exists()) {
          await set(ref(db, PATHS.playerRatings), buildUtrRatingsTable());
        }

        // Seed schedule on first run
        const sSnap = await get(ref(db, PATHS.schedule));
        if (!sSnap.exists()) {
          const list = Object.values(teamsData);
          const groupA = list.filter(t => (t.group || 'A') === 'A').sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
          const groupB = list.filter(t => t.group === 'B').sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
          if (groupA.length === 8 && groupB.length === 8) {
            const startSunday = firstSundayOnOrAfter(new Date(2026, 5, 30)); // June = month 5
            const fixtures = buildScheduleFor8x2(groupA, groupB, startSunday);
            await set(ref(db, PATHS.schedule), fixtures);
          }
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
    const unsubLegacy = onValue(ref(db, PATHS.koc2db), (snap) => {
      const list = firebaseObjectToList(snap.val(), 'KOC2DB');
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLegacyMatches(list);
    }, (error) => {
      console.error('Legacy KOC2DB load failed', error);
      setLegacyMatches([]);
    });
    const unsubLegacyFallback = onValue(ref(db, PATHS.season1), (snap) => {
      const list = firebaseObjectToList(snap.val(), 'KOC2DBPONEW');
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLegacyFallbackMatches(list);
    }, (error) => {
      console.error('Legacy KOC2DBPONEW fallback load failed', error);
      setLegacyFallbackMatches([]);
    });
    const unsubA = onValue(ref(db, PATHS.admin), (snap) => {
      setAdminConfig(snap.val() || { password: '' });
    });
    const unsubR = onValue(ref(db, PATHS.playerRatings), (snap) => {
      setPlayerRatings(snap.val() || buildUtrRatingsTable());
    });
    const unsubS = onValue(ref(db, PATHS.schedule), (snap) => {
      setSchedule(snap.val() || {});
    });
    return () => { unsubT(); unsubM(); unsubLegacy(); unsubLegacyFallback(); unsubA(); unsubR(); unsubS(); };
  }, []);

  return (
    <div className="app-shell">
      {!hideChrome && <AppHeader />}
      <Routes>
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/teams" element={<Teams teams={teams} loaded={loaded} />} />
        <Route path="/schedule" element={<Schedule teams={teams} schedule={schedule} />} />
        <Route path="/standings" element={<Standings teams={teams} matches={matches} />} />
        <Route path="/matchups" element={<Matchups matches={matches} teams={teams} />} />
        <Route path="/ptl" element={<PtlRatings matches={matches} previousMatches={[...legacyMatches, ...legacyFallbackMatches]} teams={teams} ratingLookup={playerRatings} />} />
        <Route path="/history" element={<History matches={matches} teams={teams} />} />
        <Route path="/season2" element={<Season2 />} />
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
            <Admin teams={teams} adminConfig={adminConfig} matches={matches} previousMatches={[...legacyMatches, ...legacyFallbackMatches]} schedule={schedule} playerRatings={playerRatings} />
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
