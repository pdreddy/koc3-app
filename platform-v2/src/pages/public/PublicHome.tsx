import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, CardContent, Chip, Container, Grid, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';
import type { LineupSubmission, Match, Player, ScheduleEntry, Team } from '@/types';
import { lineupDocId } from '@/types';
import { buildCapacityMap, resolveEligibilityConfig, type FixtureRecord } from '@/services/eligibilityEngine';

function formatDate(ms: number | null): string {
  if (!ms) return 'TBD';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Mirrors koc3-app's "League Navigation" tile grid on the home page — a public hub linking
// to every section, rather than leaving Home as just a title + a few chips.
const NAV_LINKS = [
  { to: 'teams', icon: '👥', label: 'Teams', desc: 'Rosters, captains, and team groups.' },
  { to: 'schedule', icon: '📅', label: 'Schedule', desc: 'Round fixtures and scores.' },
  { to: 'standings', icon: '📊', label: 'Standings', desc: 'Group tables and qualification.' },
  { to: 'matchups', icon: '🎾', label: 'Matchups', desc: 'Player and doubles matchup stats.' },
  { to: 'history', icon: '🏁', label: 'Match History', desc: 'Approved submitted results.' },
  { to: 'playoffs', icon: '🏆', label: 'Playoffs', desc: 'Knockout bracket.' },
  { to: 'rules', icon: '📋', label: 'Rules', desc: 'Format, eligibility, and scoring.' },
  { to: 'more', icon: '⋯', label: 'More', desc: 'Ratings, announcements, and login.' },
];

type FixtureStatus = 'NOT_SUBMITTED' | 'WAITING_FOR_OPPONENT' | 'YOUR_TURN' | 'REVEALED' | 'COMPLETED';

const STATUS_LABEL: Record<FixtureStatus, string> = {
  NOT_SUBMITTED: 'Lineup not submitted',
  WAITING_FOR_OPPONENT: 'Waiting for opponent to lock',
  YOUR_TURN: 'Waiting for your lineup',
  REVEALED: 'Lineups revealed — enter score when played',
  COMPLETED: 'Score submitted',
};

const STATUS_COLOR: Record<FixtureStatus, 'default' | 'warning' | 'info' | 'success'> = {
  NOT_SUBMITTED: 'default',
  WAITING_FOR_OPPONENT: 'info',
  YOUR_TURN: 'warning',
  REVEALED: 'success',
  COMPLETED: 'success',
};

function ownLinesFromMatch(match: Match, teamId: string): { playerIds: string[]; isSingles: boolean }[] {
  const isTeam1 = match.team1Id === teamId;
  return match.lines.map((line) => ({
    playerIds: isTeam1 ? line.team1PlayerIds : line.team2PlayerIds,
    isSingles: line.team1PlayerIds.length <= 1,
  }));
}

function ownLinesFromLineup(lineup: LineupSubmission): { playerIds: string[]; isSingles: boolean }[] {
  return lineup.lines.map((line) => ({ playerIds: line.playerIds, isSingles: line.playerIds.length <= 1 }));
}

// The koc3-app "captain dashboard" this replicates was Home.js itself: scheduled fixtures
// needing lineup/score action, plus a capacity/eligibility summary, all in one place rather
// than split across separate routes with no overview. This section only renders for a
// signed-in captain/vice-captain; everyone else just sees the public Explore tile grid.
function CaptainDashboard({ teamId }: { teamId: string }) {
  const { tournament, repo } = useTournament();
  const [team, setTeam] = useState<Team | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [entryStatus, setEntryStatus] = useState<Record<string, FixtureStatus>>({});
  const [roster, setRoster] = useState<Player[]>([]);
  const [capacityWarnings, setCapacityWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    let cancelled = false;
    (async () => {
      const [schedules, teamList, matches, lineups] = await Promise.all([
        repo<ScheduleEntry>('schedules').list(),
        repo<Team>('teams').list(),
        repo<Match>('matches').list(),
        repo<LineupSubmission>('lineups').list(),
      ]);
      if (cancelled) return;
      const teamMap = Object.fromEntries(teamList.map((t) => [t.id, t]));
      setTeams(teamMap);
      setTeam(teamMap[teamId] ?? null);

      const own = schedules
        .filter((e) => e.team1Id === teamId || e.team2Id === teamId)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setEntries(own);

      const status: Record<string, FixtureStatus> = {};
      own.forEach((entry) => {
        if (entry.status === 'PLAYED') { status[entry.id] = 'COMPLETED'; return; }
        const ownLineup = lineups.find((l) => l.id === lineupDocId(entry.id, teamId));
        const opponentId = entry.team1Id === teamId ? entry.team2Id : entry.team1Id;
        const opponentLineup = lineups.find((l) => l.id === lineupDocId(entry.id, opponentId));
        if (!ownLineup?.lockedAt) status[entry.id] = 'NOT_SUBMITTED';
        else if (!opponentLineup?.lockedAt) status[entry.id] = 'WAITING_FOR_OPPONENT';
        else status[entry.id] = 'REVEALED';
      });
      setEntryStatus(status);

      const playerIds = teamMap[teamId]?.playerIds ?? [];
      const players = await Promise.all(playerIds.map((id) => repo<Player>('players').get(id)));
      const rosterList = players.filter((p): p is Player => Boolean(p));
      if (cancelled) return;
      setRoster(rosterList);

      const eligibility = resolveEligibilityConfig(tournament.config.eligibility);
      if (eligibility.enabled) {
        const byFixture = new Map<string, FixtureRecord>();
        lineups
          .filter((l) => l.teamId === teamId && l.lockedAt != null)
          .forEach((l) => byFixture.set(l.scheduleEntryId, { scheduleEntryId: l.scheduleEntryId, lines: ownLinesFromLineup(l) }));
        matches
          .filter((m) => m.status === 'APPROVED' && (m.team1Id === teamId || m.team2Id === teamId) && m.scheduleEntryId)
          .forEach((m) => byFixture.set(m.scheduleEntryId!, { scheduleEntryId: m.scheduleEntryId!, lines: ownLinesFromMatch(m, teamId) }));
        const capacity = buildCapacityMap(Array.from(byFixture.values()));
        const warnings: string[] = [];
        rosterList.forEach((p) => {
          const cap = capacity[p.id];
          if (!cap) return;
          if (eligibility.maxSinglesDaysPerPlayer != null && cap.singlesDays >= eligibility.maxSinglesDaysPerPlayer) {
            warnings.push(`${p.displayName} is at the singles cap (${cap.singlesDays}/${eligibility.maxSinglesDaysPerPlayer})`);
          }
          if (eligibility.maxTotalMatchDaysPerPlayer != null && cap.totalDays >= eligibility.maxTotalMatchDaysPerPlayer) {
            warnings.push(`${p.displayName} is at the total match-day cap (${cap.totalDays}/${eligibility.maxTotalMatchDaysPerPlayer})`);
          }
        });
        setCapacityWarnings(warnings);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tournament, teamId, repo]);

  if (!tournament) return null;
  const basePath = `/t/${tournament.slug}`;
  const upcoming = entries.filter((e) => e.status !== 'PLAYED');
  const completed = entries.filter((e) => e.status === 'PLAYED').slice(0, 5);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Your Team{team ? `: ${team.name}` : ''}</Typography>

      {loading ? (
        <Typography color="text.secondary">Loading your dashboard…</Typography>
      ) : (
        <>
          {capacityWarnings.length > 0 && (
            <GradientCard>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>⚠️ Capacity Warnings</Typography>
                <Stack spacing={0.5}>
                  {capacityWarnings.map((w, i) => <Typography key={i} variant="body2" color="text.secondary">{w}</Typography>)}
                </Stack>
              </CardContent>
            </GradientCard>
          )}

          <Stack spacing={1}>
            <Typography variant="subtitle2">Scheduled Matches</Typography>
            {upcoming.length === 0 && <Typography color="text.secondary" variant="body2">No upcoming matches.</Typography>}
            {upcoming.map((entry) => {
              const opponentId = entry.team1Id === teamId ? entry.team2Id : entry.team1Id;
              const status = entryStatus[entry.id] ?? 'NOT_SUBMITTED';
              return (
                <GradientCard key={entry.id}>
                  <CardContent sx={{ pt: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1}>
                      <Box>
                        <Typography variant="subtitle2">vs {teams[opponentId]?.name ?? '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{entry.date} · {entry.time} · Round {entry.round}</Typography>
                      </Box>
                      <Chip size="small" color={STATUS_COLOR[status]} label={STATUS_LABEL[status]} />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button size="small" variant="outlined" component={RouterLink} to={`${basePath}/lineup`}>
                        {status === 'NOT_SUBMITTED' ? 'Submit Lineup' : 'View Lineup'}
                      </Button>
                      <Button size="small" variant="contained" disabled={status !== 'REVEALED'} component={RouterLink} to={`${basePath}/score`}>
                        Enter Score
                      </Button>
                    </Stack>
                  </CardContent>
                </GradientCard>
              );
            })}
          </Stack>

          {completed.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Recently Completed</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Date</TableCell><TableCell>Opponent</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {completed.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>vs {teams[entry.team1Id === teamId ? entry.team2Id : entry.team1Id]?.name ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button size="small" component={RouterLink} to={`${basePath}/history`} sx={{ alignSelf: 'flex-start' }}>View full history →</Button>
            </Stack>
          )}

          {roster.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Roster: {roster.map((p) => p.displayName).join(', ')}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

function HomeContent() {
  const { tournament } = useTournament();
  const { role, teamId, loading: roleLoading } = useTournamentRole();
  if (!tournament) return null;
  const { info, structure } = tournament.config;
  const isCaptain = (role === 'CAPTAIN' || role === 'VICE_CAPTAIN') && Boolean(teamId);

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          title={info.name}
          subtitle={info.description || undefined}
          action={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              <Chip label={`${structure.teamCount} teams`} />
              <Chip label={`${structure.groupCount} groups`} />
              <Chip label={`${formatDate(info.startsAt)} – ${formatDate(info.endsAt)}`} />
              {info.location && <Chip label={info.location} />}
            </Stack>
          }
        />

        {!roleLoading && isCaptain && <CaptainDashboard teamId={teamId!} />}

        <Typography variant="h6">Explore</Typography>
        <Grid container spacing={2}>
          {NAV_LINKS.map((link) => (
            <Grid item xs={6} sm={4} md={3} key={link.to}>
              <GradientCard sx={{ height: '100%' }}>
                <Box component={RouterLink} to={link.to} sx={{ display: 'block', p: 2, pt: 2.5, textDecoration: 'none', color: 'inherit' }}>
                  <Typography sx={{ fontSize: '1.5rem' }}>{link.icon}</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>{link.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{link.desc}</Typography>
                </Box>
              </GradientCard>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

export default function PublicHome() {
  return (
    <VisibilityGate pageId="home">
      <HomeContent />
    </VisibilityGate>
  );
}
