import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, CardContent, Container, Grid, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { Match, Player, ScheduleEntry, Team } from '@/types';
import { computeStandings, groupStandings } from '@/services/standingsEngine';
import { computePlayerStats } from '@/services/playerStatsEngine';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <GradientCard>
      <CardContent>
        <Typography variant="h4">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </GradientCard>
  );
}

// Buckets APPROVED matches by ISO week (Monday-start) so there's at least one at-a-glance
// activity trend — a plain CSS bar chart (Box width %), no charting library pulled in for
// something this simple.
function weekBucket(epochMs: number): string {
  const d = new Date(epochMs);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function ActivityChart({ matches }: { matches: Match[] }) {
  const counts: Record<string, number> = {};
  matches.forEach((m) => {
    if (!m.playedAt) return;
    const key = weekBucket(m.playedAt);
    counts[key] = (counts[key] ?? 0) + 1;
  });
  const weeks = Object.keys(counts).sort();
  if (weeks.length === 0) return <Typography color="text.secondary">No approved matches yet.</Typography>;
  const max = Math.max(...weeks.map((w) => counts[w]));

  return (
    <Stack spacing={1}>
      {weeks.map((w) => (
        <Stack key={w} direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ width: 90 }}>{w}</Typography>
          <Box sx={{ flexGrow: 1, bgcolor: 'action.hover', borderRadius: 1, height: 16 }}>
            <Box sx={{ width: `${(counts[w] / max) * 100}%`, bgcolor: 'primary.main', height: '100%', borderRadius: 1 }} />
          </Box>
          <Typography variant="caption" sx={{ width: 24, textAlign: 'right' }}>{counts[w]}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function AnalyticsDashboardContent() {
  const { tournament, repo } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      repo<Team>('teams').list(), repo<Player>('players').list(),
      repo<Match>('matches').list(), repo<ScheduleEntry>('schedules').list(),
    ]).then(([t, p, m, s]) => {
      setTeams(t); setPlayers(p); setMatches(m); setSchedules(s); setLoading(false);
    });
  }, [tournament, repo]);

  if (loading || !tournament) return <Typography color="text.secondary">Loading analytics…</Typography>;

  const approved = matches.filter((m) => m.status === 'APPROVED');
  const pending = matches.filter((m) => m.status === 'PENDING_APPROVAL');
  const completion = schedules.length > 0 ? Math.round((schedules.filter((s) => s.status === 'PLAYED').length / schedules.length) * 100) : 0;

  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));
  const standingsByGroup = groupStandings(computeStandings(teams, matches, tournament.config.standings));
  const topPlayers = Object.values(computePlayerStats(matches))
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 5);

  return (
    <Stack spacing={4}>
      <PageHeader title="Analytics" subtitle="Summary stats computed from this tournament's data." />

      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}><StatCard label="Teams" value={teams.length} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Players" value={players.length} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Matches Approved" value={approved.length} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Pending Approval" value={pending.length} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Schedule Completion" value={`${completion}%`} /></Grid>
      </Grid>

      <Stack spacing={1.5}>
        <Typography variant="h6">Match Activity by Week</Typography>
        <ActivityChart matches={approved} />
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">Group Leaders</Typography>
        {Object.keys(standingsByGroup).length === 0 ? (
          <Typography color="text.secondary">No standings yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Group</TableCell><TableCell>Leader</TableCell><TableCell align="right">Wins</TableCell><TableCell align="right">Points</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(standingsByGroup).map(([group, rows]) => (
                <TableRow key={group}>
                  <TableCell>{group}</TableCell>
                  <TableCell>{rows[0]?.team.name ?? '—'}</TableCell>
                  <TableCell align="right">{rows[0]?.wins ?? '—'}</TableCell>
                  <TableCell align="right">{rows[0]?.points ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">Top Players</Typography>
        {topPlayers.length === 0 ? (
          <Typography color="text.secondary">No completed lines yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Player</TableCell><TableCell align="right">Wins</TableCell><TableCell align="right">Losses</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {topPlayers.map((row) => (
                <TableRow key={row.playerId}>
                  <TableCell>{playerById[row.playerId]?.displayName ?? row.playerId}</TableCell>
                  <TableCell align="right">{row.wins}</TableCell>
                  <TableCell align="right">{row.losses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Stack>
  );
}

export default function AnalyticsDashboard() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <AnalyticsDashboardContent />
      </TournamentProvider>
    </Container>
  );
}
