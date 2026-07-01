import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_CLUB_ID, getClub } from '../config/clubs';
import { getClubPaths } from '../firebasePaths';
import { getLeagueConfig } from '../config/leagueConfig';

const ClubContext = createContext(null);

// Phase 1: always resolves to KOC (today's only club). This is the seam a future
// club-picker / subdomain resolver plugs into — no existing page reads from this
// context yet, so adding the provider does not change current app behavior.
export function ClubProvider({ clubId = DEFAULT_CLUB_ID, children }) {
  const value = useMemo(() => {
    const club = getClub(clubId);
    return {
      clubId: club.id,
      club,
      paths: getClubPaths(club.id),
      leagueConfig: getLeagueConfig(club.id, club.dataRoot),
    };
  }, [clubId]);

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used within ClubProvider');
  return ctx;
}
