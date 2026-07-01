import React from 'react';
import { Alert, Container, Typography } from '@mui/material';
import { useTournament } from '@/contexts/TournamentContext';
import { canViewAtLevel, useTournamentRole } from '@/hooks/useTournamentRole';
import { DEFAULT_VISIBILITY } from '@/types';

// The admin-configurable per-page access control described in the spec's "Screen
// Visibility" step: reads tournament.config.visibility[pageId] and compares it against the
// signed-in user's resolved role for this tournament (useTournamentRole). This is a UI-only
// gate for a good experience (redirect to login, show a clear "you don't have access"
// message) — it is NOT a substitute for firestore.rules, which is the actual security
// boundary. A user who can see a locked-down page's data via devtools/direct API calls is
// only stopped by the rules, not by this component.
export function VisibilityGate({ pageId, children }: { pageId: string; children: React.ReactNode }) {
  const { tournament, loading: tournamentLoading } = useTournament();
  const { level, loading: roleLoading } = useTournamentRole();

  if (tournamentLoading || roleLoading) return null;
  if (!tournament) return <Alert severity="error">Tournament not found.</Alert>;

  // Fall back to the shipped default for any page id missing from this tournament's saved
  // config — e.g. a tournament created before a new page existed won't have that key in
  // its stored visibility map, and should pick up the new page's sensible default instead
  // of failing closed as 'ADMIN' for everyone including the tournament's own admin.
  const required = tournament.config.visibility[pageId] ?? DEFAULT_VISIBILITY[pageId] ?? 'ADMIN';
  if (required === 'HIDDEN') {
    return (
      <Container sx={{ py: 6 }}>
        <Typography color="text.secondary">This page isn't available for this tournament.</Typography>
      </Container>
    );
  }
  if (!canViewAtLevel(level, required)) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="warning">
          {required === 'LOGIN_REQUIRED' && 'Please log in to view this page.'}
          {required === 'REGISTERED_PLAYER' && 'This page is only available to registered players.'}
          {required === 'CAPTAIN' && 'This page is only available to team captains.'}
          {required === 'ADMIN' && 'This page is only available to tournament admins.'}
        </Alert>
      </Container>
    );
  }
  return <>{children}</>;
}
