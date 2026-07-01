import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Tournament } from '@/types';
import { TournamentService } from '@/services/TournamentService';
import { TournamentScopedRepository } from '@/services/TournamentRepository';
import type { TournamentSubcollection } from '@/services/firestorePaths';

interface TournamentContextValue {
  tournament: Tournament | null;
  loading: boolean;
  error: string | null;
  /** Scoped repository factory — every screen gets its data access through this, never a
   * hand-written Firestore path. Throws if no tournament is loaded yet. */
  repo: <T extends { id: string }>(subcollection: TournamentSubcollection) => TournamentScopedRepository<T>;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

// Resolves the active tournament either by Firestore document id (admin screens, which
// know the id from the Tournament Manager list) or by public slug (the /t/:slug site).
// Every descendant reads the tournament through useTournament() instead of ever importing
// TournamentService/TournamentRepository directly with a hand-typed id.
export function TournamentProvider({
  tournamentId,
  slug,
  children,
}: {
  tournamentId?: string;
  slug?: string;
  children: React.ReactNode;
}) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTournament(null);

    async function load() {
      try {
        if (!tournamentId && !slug) throw new Error('TournamentProvider requires either tournamentId or slug');
        const result = tournamentId
          ? await TournamentService.get(tournamentId)
          : await TournamentService.getBySlug(slug!);
        if (cancelled) return;
        if (!result) throw new Error(`Tournament not found (${tournamentId ? `id=${tournamentId}` : `slug=${slug}`})`);
        setTournament(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, slug]);

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournament,
      loading,
      error,
      repo: (subcollection) => {
        if (!tournament) throw new Error('Cannot access repo before the tournament has loaded');
        return new TournamentScopedRepository(tournament.id, subcollection);
      },
    }),
    [tournament, loading, error]
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within a TournamentProvider');
  return ctx;
}
