import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament } from '@/contexts/TournamentContext';
import type { TournamentPermission, VisibilityLevel } from '@/types';

// Achieved "level" for the signed-in user within the *current* tournament — independent of
// what page they're trying to view. HIDDEN is not an achievable level (it's only ever a
// page requirement, never something a role satisfies).
const LEVEL_ORDER: Record<Exclude<VisibilityLevel, 'HIDDEN'>, number> = {
  PUBLIC: 0,
  LOGIN_REQUIRED: 1,
  REGISTERED_PLAYER: 2,
  CAPTAIN: 3,
  ADMIN: 4,
};

function levelForRole(role: TournamentPermission['role'] | null, signedIn: boolean): number {
  if (!signedIn) return LEVEL_ORDER.PUBLIC;
  if (!role) return LEVEL_ORDER.LOGIN_REQUIRED; // signed in, but not registered/assigned a role in this tournament
  if (role === 'TOURNAMENT_ADMIN' || role === 'ORGANIZER') return LEVEL_ORDER.ADMIN;
  if (role === 'CAPTAIN' || role === 'VICE_CAPTAIN') return LEVEL_ORDER.CAPTAIN;
  return LEVEL_ORDER.REGISTERED_PLAYER; // PLAYER
}

export function canViewAtLevel(achievedLevel: number, required: VisibilityLevel): boolean {
  if (required === 'HIDDEN') return false;
  return achievedLevel >= LEVEL_ORDER[required];
}

/** Resolves the signed-in user's effective role + visibility "level" for the active tournament. */
export function useTournamentRole() {
  const { user, loading: authLoading } = useAuth();
  const { tournament, loading: tournamentLoading, repo } = useTournament();
  const [permission, setPermission] = useState<TournamentPermission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading || tournamentLoading || !tournament) {
      setLoading(authLoading || tournamentLoading);
      return;
    }
    if (!user) {
      setPermission(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    repo<TournamentPermission>('permissions')
      .get(user.uid)
      .then((p) => { if (!cancelled) { setPermission(p); setLoading(false); } })
      .catch(() => { if (!cancelled) { setPermission(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user, tournament, authLoading, tournamentLoading, repo]);

  const level = levelForRole(permission?.role ?? null, Boolean(user));

  return { role: permission?.role ?? null, teamId: permission?.teamId ?? null, level, loading };
}
