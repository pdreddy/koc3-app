import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { DEFAULT_CLUB_ID, getClub } from '../config/clubs';
import { getClubPaths } from '../firebasePaths';
import { getLeagueConfig } from '../config/leagueConfig';

const ClubContext = createContext(null);

// Syncs document.title and the theme-color meta tag to the active club's branding.
// KOC's branding config reproduces the values already hardcoded in index.html, so this
// is a no-op change in output for KOC — it just makes those values config-driven instead
// of static, ready for a future club to get a different title/theme-color at runtime.
// (Build-time-only PWA assets — manifest.json, favicon, apple-touch-icon — aren't
// swappable at runtime and remain a per-deployment concern; see the plan doc.)
function useDocumentBranding(branding) {
  useEffect(() => {
    if (branding?.documentTitle) document.title = branding.documentTitle;
    if (branding?.themeColor) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', branding.themeColor);
    }
  }, [branding?.documentTitle, branding?.themeColor]);
}

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

  useDocumentBranding(value.club.branding);

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used within ClubProvider');
  return ctx;
}
