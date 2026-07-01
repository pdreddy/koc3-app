import { useEffect, useState } from 'react';
import { Alert, Container, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Match, Player } from '@/types';
import { computePlayerStats, computeSimpleRating } from '@/services/playerStatsEngine';
import { PageHeader } from '@/components/layout/PageHeader';

function RatingsContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    Promise.all([repo<Match>('matches').list(), repo<Player>('players').list()]).then(([m, p]) => {
      setMatches(m);
      setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  if (loading) return <Typography color="text.secondary">Loading ratings…</Typography>;

  const stats = Object.values(computePlayerStats(matches))
    .map((row) => ({ ...row, rating: computeSimpleRating(row) }))
    .sort((a, b) => b.rating - a.rating);

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Rating is a simplified win-percentage-derived number (5.0 = .500 record), not the
        original koc3-app PTL/PPRC rating algorithm — that formula wasn't ported, only the
        idea of a ranked ratings list.
      </Alert>
      <Table size="small">
        <TableHead>
          <TableRow><TableCell>#</TableCell><TableCell>Player</TableCell><TableCell align="right">Rating</TableCell><TableCell align="right">W-L</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {stats.map((row, idx) => (
            <TableRow key={row.playerId}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{players[row.playerId]?.displayName ?? row.playerId}</TableCell>
              <TableCell align="right">{row.rating.toFixed(2)}</TableCell>
              <TableCell align="right">{row.wins}-{row.losses}</TableCell>
            </TableRow>
          ))}
          {stats.length === 0 && <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No matches played yet.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </Stack>
  );
}

export default function Ratings() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Player Ratings" subtitle="A simplified win-percentage-derived ranking." />
      <VisibilityGate pageId="ratings">
        <RatingsContent />
      </VisibilityGate>
    </Container>
  );
}
