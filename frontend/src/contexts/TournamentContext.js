import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_TOURNAMENT_CONFIG, DEFAULT_TOURNAMENT_ID } from '../config/tournamentPlatform';
import { setCurrentTournamentId } from '../firebasePaths';

const TournamentContext = createContext(null);

function normalizeTournamentId(value) {
  return String(value || DEFAULT_TOURNAMENT_ID).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || DEFAULT_TOURNAMENT_ID;
}

function readStoredTournamentId() {
  try { return normalizeTournamentId(window.localStorage.getItem('currentTournamentId')); } catch { return DEFAULT_TOURNAMENT_ID; }
}

export function TournamentProvider({ children }) {
  const location = useLocation();
  const [selectedTournamentId, setSelectedTournamentId] = useState(readStoredTournamentId);
  const routeTournamentId = location.pathname.match(/^\/t\/([^/]+)/)?.[1];
  const currentTournamentId = normalizeTournamentId(routeTournamentId || selectedTournamentId || DEFAULT_TOURNAMENT_ID);
  setCurrentTournamentId(currentTournamentId);

  useEffect(() => {
    setCurrentTournamentId(currentTournamentId);
    try { window.localStorage.setItem('currentTournamentId', currentTournamentId); } catch {}
  }, [currentTournamentId]);

  const selectTournament = useCallback((id) => setSelectedTournamentId(normalizeTournamentId(id)), []);

  const currentTournament = useMemo(() => ({
    ...DEFAULT_TOURNAMENT_CONFIG,
    id: currentTournamentId,
    slug: currentTournamentId,
    isDefaultKoc: currentTournamentId === DEFAULT_TOURNAMENT_ID,
    publicBasePath: `/t/${currentTournamentId}`,
    pathname: location.pathname
  }), [currentTournamentId, location.pathname]);

  const value = useMemo(() => ({ currentTournament, currentTournamentId, selectTournament, normalizeTournamentId }), [currentTournament, currentTournamentId, selectTournament]);
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used within TournamentProvider');
  return context;
}
