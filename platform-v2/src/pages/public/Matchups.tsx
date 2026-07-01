import { useEffect, useState } from 'react';
import { Container, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tab, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Match, Player } from '@/types';
import { computePartnerships, computePlayerStats } from '@/services/playerStatsEngine';
import { PageHeader } from '@/components/layout/PageHeader';

function MatchupsContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (tournamentLoading) return;
    Promise.all([repo<Match>('matches').list(), repo<Player>('players').list()]).then(([m, p]) => {
      setMatches(m);
      setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  if (loading) return <Typography color="text.secondary">Loading matchups…</Typography>;

  const stats = Object.values(computePlayerStats(matches)).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  const partnerships = computePartnerships(matches);
  const name = (id: string) => players[id]?.displayName ?? id;

  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Player Stats" />
        <Tab label="Doubles Partnerships" />
      </Tabs>

      {tab === 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell><TableCell align="right">Match Days</TableCell>
              <TableCell align="right">W-L</TableCell><TableCell align="right">Singles</TableCell><TableCell align="right">Doubles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.map((row) => (
              <TableRow key={row.playerId}>
                <TableCell>{name(row.playerId)}</TableCell>
                <TableCell align="right">{row.matchDaysPlayed}</TableCell>
                <TableCell align="right">{row.wins}-{row.losses}</TableCell>
                <TableCell align="right">{row.singlesRecord.wins}-{row.singlesRecord.losses}</TableCell>
                <TableCell align="right">{row.doublesRecord.wins}-{row.doublesRecord.losses}</TableCell>
              </TableRow>
            ))}
            {stats.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No matches played yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      {tab === 1 && (
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Pair</TableCell><TableCell align="right">Played</TableCell><TableCell align="right">W-L</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {partnerships.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{name(row.playerIds[0])} / {name(row.playerIds[1])}</TableCell>
                <TableCell align="right">{row.matchesPlayed}</TableCell>
                <TableCell align="right">{row.wins}-{row.losses}</TableCell>
              </TableRow>
            ))}
            {partnerships.length === 0 && <TableRow><TableCell colSpan={3}><Typography color="text.secondary">No doubles played yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

export default function Matchups() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Matchups" subtitle="Player, singles, and doubles matchup stats." />
      <VisibilityGate pageId="matchups">
        <MatchupsContent />
      </VisibilityGate>
    </Container>
  );
}
