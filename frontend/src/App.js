import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onValue, ref, set, get, update } from 'firebase/database';
import { db, ensureAuth, PATHS } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ROLES, hasRole } from './utils/roles';
import { buildInitialTeams, canonicalTeamIdentityUpdates, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERS, normalizeAdminUsername } from './data/initialTeams';
import { buildUtrRatingsTable } from './data/utrRatings';
import { sortByGroupOrder } from './data/auctionTeams';
import { auctionPlayerRatingUpdates, buildAuctionPlayerRatingsTable } from './data/auctionPlayers';
import { buildScheduleFor8x2, KOC3_SCHEDULE_VERSION } from './utils/roundRobin';
import { DEFAULT_ELIGIBILITY_RULES, normalizeEligibilityRules } from './utils/eligibilityRules';

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
import PtlRatings from './pages/PtlRatings';
import AuditLogs from './pages/AuditLogs';
import { writeAuditLog } from './services/AuditService';

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
  const [adminConfig, setAdminConfig] = useState({ password: '', users: {} });
  const [schedule, setSchedule] = useState({});
  const [settings, setSettings] = useState({ eligibilityRules: DEFAULT_ELIGIBILITY_RULES });
  const [loaded, setLoaded] = useState(false);


  const syncSavedMatch = useCallback((record) => {
    if (!record?.id) return;
    setMatches(prev => {
      const next = [record, ...prev.filter(match => match.id !== record.id)];
      next.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return next;
    });
  }, []);

  const syncDeletedMatch = useCallback((matchId) => {
    if (!matchId) return;
    setMatches(prev => prev.filter(match => match.id !== matchId));
  }, []);

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
          Object.assign(updates, canonicalTeamIdentityUpdates(teamsData));
          if (Object.keys(updates).length > 0) {
            await update(ref(db, PATHS.teams), updates);
          }
        }

        const aSnap = await get(ref(db, PATHS.admin));
        if (!aSnap.exists()) {
          await set(ref(db, PATHS.admin), { password: DEFAULT_ADMIN_PASSWORD });
        }

        const auSnap = await get(ref(db, PATHS.adminUsers));
        const adminUsers = auSnap.val() || {};
        const existingAdminUsers = Object.keys(adminUsers).reduce((lookup, username) => {
          lookup[normalizeAdminUsername(username)] = true;
          return lookup;
        }, {});
        const missingAdminUsers = Object.entries(DEFAULT_ADMIN_USERS).reduce((updates, [username, user]) => {
          if (!existingAdminUsers[username]) updates[username] = user;
          return updates;
        }, {});
        if (Object.keys(missingAdminUsers).length > 0) {
          await update(ref(db, PATHS.adminUsers), missingAdminUsers);
        }

        const settingsSnap = await get(ref(db, PATHS.settings));
        if (!settingsSnap.exists()) {
          await set(ref(db, PATHS.settings), { eligibilityRules: DEFAULT_ELIGIBILITY_RULES });
        }

        const rSnap = await get(ref(db, PATHS.playerRatings));
        if (!rSnap.exists()) {
          await set(ref(db, PATHS.playerRatings), { ...buildUtrRatingsTable(), ...buildAuctionPlayerRatingsTable() });
        } else {
          await update(ref(db, PATHS.playerRatings), auctionPlayerRatingUpdates());
        }

        // Seed schedule on first run
        const sSnap = await get(ref(db, PATHS.schedule));
        const scheduleData = sSnap.val() || {};
        const scheduleMatches = Object.values(scheduleData).filter(item => item?.type !== 'buffer');
        const shouldSeedSchedule = !sSnap.exists() || scheduleMatches.length === 0 || scheduleMatches.some(item => item?.scheduleVersion !== KOC3_SCHEDULE_VERSION);
        if (shouldSeedSchedule) {
          const list = Object.values(buildInitialTeams()).map(canonical => ({
            ...canonical,
            ...(teamsData[canonical.id] || {}),
            group: canonical.group,
            groupOrder: canonical.groupOrder
          }));
          const groupA = list.filter(t => (t.group || 'A') === 'A').sort(sortByGroupOrder);
          const groupB = list.filter(t => t.group === 'B').sort(sortByGroupOrder);
          if (groupA.length === 8 && groupB.length === 8) {
            const fixtures = buildScheduleFor8x2(groupA, groupB);
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
      setAdminConfig(prev => ({ ...prev, ...(snap.val() || { password: '' }) }));
    });
    const unsubAU = onValue(ref(db, PATHS.adminUsers), (snap) => {
      setAdminConfig(prev => ({ ...prev, users: snap.val() || {} }));
    });
    const unsubR = onValue(ref(db, PATHS.playerRatings), (snap) => {
      setPlayerRatings(snap.val() || buildUtrRatingsTable());
    });
    const unsubS = onValue(ref(db, PATHS.schedule), (snap) => {
      setSchedule(snap.val() || {});
    });
    const unsubSettings = onValue(ref(db, PATHS.settings), (snap) => {
      const value = snap.val() || {};
      setSettings({ ...value, eligibilityRules: normalizeEligibilityRules(value.eligibilityRules) });
    });
    return () => { unsubT(); unsubM(); unsubLegacy(); unsubLegacyFallback(); unsubA(); unsubAU(); unsubR(); unsubS(); unsubSettings(); };
  }, []);

  return (
    <div className="app-shell">
      <ActivityAudit />
      {!hideChrome && <AppHeader />}
      <Routes>
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/teams" element={<Teams teams={teams} loaded={loaded} matches={matches} eligibilityRules={settings.eligibilityRules} />} />
        <Route path="/schedule" element={<Schedule teams={teams} schedule={schedule} />} />
        <Route path="/standings" element={<Standings teams={teams} matches={matches} />} />
        <Route path="/matchups" element={<Matchups matches={matches} teams={teams} />} />
        <Route path="/ptl" element={<PtlRatings matches={matches} previousMatches={[...legacyMatches, ...legacyFallbackMatches]} teams={teams} ratingLookup={playerRatings} />} />
        <Route path="/history" element={<History matches={matches} teams={teams} onMatchDeleted={syncDeletedMatch} />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/more" element={<More />} />
        <Route path="/login" element={<Login teams={teams} adminConfig={adminConfig} />} />
        <Route path="/score" element={
          <ProtectedTeam>
            <ScoreEntry teams={teams} matches={matches} eligibilityRules={settings.eligibilityRules} onScoreSaved={syncSavedMatch} />
          </ProtectedTeam>
        } />
        <Route path="/audit" element={
          <ProtectedRoles allowed={[ROLES.SUPER_ADMIN]} next="/audit">
            <AuditLogs />
          </ProtectedRoles>
        } />
        <Route path="/admin" element={
          <ProtectedAdmin>
            <Admin teams={teams} adminConfig={adminConfig} matches={matches} previousMatches={[...legacyMatches, ...legacyFallbackMatches]} schedule={schedule} playerRatings={playerRatings} settings={settings} />
          </ProtectedAdmin>
        } />
        <Route path="*" element={<Navigate to="/teams" replace />} />
      </Routes>
      {!hideChrome && <BottomNav />}
    </div>
  );
}

function ActivityAudit() {
  const location = useLocation();
  const { session } = useAuth();
  const lastEvent = useRef('');

  useEffect(() => {
    if (hasRole(session, [ROLES.GUEST])) return;
    const path = `${location.pathname}${location.search || ''}`;
    const actor = session?.teamId || session?.userId || session?.role || 'unknown';
    const eventKey = `${actor}:${path}`;
    if (lastEvent.current === eventKey) return;
    lastEvent.current = eventKey;
    writeAuditLog({
      actionType: hasRole(session, [ROLES.CAPTAIN]) ? 'Captain Page View' : 'Admin Page View',
      session,
      targetType: 'route',
      targetId: path
    }).catch(error => console.error('Activity audit failed', error));
  }, [location.pathname, location.search, session]);

  return null;
}

function ProtectedRoles({ allowed, next, children }) {
  const { session } = useAuth();
  if (!hasRole(session, allowed)) {
    return <Navigate to="/login" replace state={{ next }} />;
  }
  return children;
}

function ProtectedTeam({ children }) {
  const { session } = useAuth();
  if (!hasRole(session, [ROLES.CAPTAIN, ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
    return <Navigate to="/login" replace state={{ next: '/score' }} />;
  }
  return children;
}

function ProtectedAdmin({ children }) {
  const { session } = useAuth();
  if (!hasRole(session, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
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
