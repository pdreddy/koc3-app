import { useEffect, useState } from 'react';
import { Container, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Match, Team } from '@/types';
import { computeStandings, groupStandings } from '@/services/standingsEngine';

function StandingsContent() {
  const { tournament, repo, loading: tournamentLoading } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    let cancelled = false;
    Promise.all([repo<Team>('teams').list(), repo<Match>('matches').list()]).then(([t, m]) => {
      if (cancelled) return;
      setTeams(t);
      setMatches(m);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [repo, tournamentLoading]);

  if (loading || !tournament) return <Typography color="text.secondary">Loading standings…</Typography>;
  if (teams.length === 0) return <Typography color="text.secondary">No teams yet.</Typography>;

  const rows = computeStandings(teams, matches, tournament.config.standings);
  const byGroup = groupStandings(rows);
  const qualifyTop = tournament.config.playoffs.enabled ? tournament.config.playoffs.qualifyPerGroup : 0;

  return (
    <Stack spacing={4}>
      {Object.entries(byGroup).map(([group, groupRows]) => (
        <Stack key={group} spacing={1.5}>
          <Typography variant="h6">Group {group}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Team</TableCell>
                <TableCell align="right">P</TableCell>
                <TableCell align="right">W</TableCell>
                <TableCell align="right">L</TableCell>
                <TableCell align="right">Pts</TableCell>
                <TableCell align="right">Sets</TableCell>
                <TableCell align="right">Games</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupRows.map((row, idx) => (
                <TableRow key={row.teamId} selected={idx < qualifyTop}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.team.name}</TableCell>
                  <TableCell align="right">{row.played}</TableCell>
                  <TableCell align="right">{row.wins}</TableCell>
                  <TableCell align="right">{row.losses}</TableCell>
                  <TableCell align="right">{row.points}</TableCell>
                  <TableCell align="right">{row.setsWon}-{row.setsLost}</TableCell>
                  <TableCell align="right">{row.gamesWon}-{row.gamesLost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      ))}
    </Stack>
  );
}

export default function PublicStandings() {
  return (
    <Container sx={{ py: 4 }}>
      <VisibilityGate pageId="standings">
        <StandingsContent />
      </VisibilityGate>
    </Container>
  );
}
