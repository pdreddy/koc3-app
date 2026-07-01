import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Chip, Container, MenuItem, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { LineupSubmission, Match, Player, ScheduleEntry, SetScore, Team } from '@/types';
import { lineupDocId } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

function setScoreLabel(set: SetScore): string {
  if (set.matchTiebreak) return `[${set.matchTiebreak.team1}-${set.matchTiebreak.team2}]`;
  const base = `${set.team1}-${set.team2}`;
  return set.tiebreak ? `${base}(${Math.min(set.tiebreak.team1, set.tiebreak.team2)})` : base;
}

// One fixture, with an inline expandable score/lineup-reveal panel — public, matching
// koc3-app's Schedule.js, which shows both to any visitor once available, not just to the
// teams involved. See firestore.rules' lineups read rule, which intentionally drops the
// isSignedIn() check for the reveal case.
function ScheduleRow({
  entry, team1Name, team2Name, match, lineup1, lineup2, playerName,
}: {
  entry: ScheduleEntry; team1Name: string; team2Name: string; match: Match | null;
  lineup1: LineupSubmission | null; lineup2: LineupSubmission | null; playerName: (id: string) => string;
}) {
  const revealed = Boolean(lineup1?.lockedAt && lineup2?.lockedAt);
  const scored = Boolean(match && match.status === 'APPROVED');

  return (
    <GradientCard>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ p: 2, pt: 2.5 }}>
        <Typography variant="body2" sx={{ minWidth: 90 }} color="text.secondary">Round {entry.round}</Typography>
        <Typography variant="body2" sx={{ minWidth: 130 }} color="text.secondary">{entry.date} · {entry.time}</Typography>
        <Typography sx={{ flexGrow: 1 }}>{team1Name} vs {team2Name}</Typography>
        <Chip size="small" label={entry.status} />
      </Stack>
      {(revealed || scored) && (
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' }, bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
            <Typography variant="body2">{scored ? 'View score' : 'View revealed lineups'}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2 }}>
            {scored && match && (
              <Table size="small" sx={{ mb: revealed ? 2 : 0 }}>
                <TableHead>
                  <TableRow><TableCell>Line</TableCell><TableCell>Sets</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {match.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell>{line.sets.map(setScoreLabel).join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {revealed && lineup1 && lineup2 && (
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Line</TableCell><TableCell>{team1Name}</TableCell><TableCell>{team2Name}</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {lineup1.lines.map((line) => {
                    const opponentLine = lineup2.lines.find((l) => l.label === line.label);
                    return (
                      <TableRow key={line.label}>
                        <TableCell>{line.label}</TableCell>
                        <TableCell>{line.playerIds.map(playerName).join(' / ')}</TableCell>
                        <TableCell>{(opponentLine?.playerIds ?? []).map(playerName).join(' / ')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </GradientCard>
  );
}

function ScheduleContent() {
  const { tournament, repo } = useTournament();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [lineups, setLineups] = useState<Record<string, LineupSubmission>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  useEffect(() => {
    // Guard on `tournament` itself, not just the loading flag — see the note in
    // pages/public/PublicTeams.tsx.
    if (!tournament) return;
    let cancelled = false;
    Promise.all([
      repo<ScheduleEntry>('schedules').list(), repo<Team>('teams').list(),
      repo<Match>('matches').list(), repo<LineupSubmission>('lineups').list(), repo<Player>('players').list(),
    ]).then(([schedules, teamList, matchList, lineupList, playerList]) => {
      if (cancelled) return;
      setEntries(schedules.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
      setTeams(Object.fromEntries(teamList.map((t) => [t.id, t])));
      setMatches(Object.fromEntries(matchList.filter((m) => m.id).map((m) => [m.id, m])));
      setLineups(Object.fromEntries(lineupList.map((l) => [l.id, l])));
      setPlayers(Object.fromEntries(playerList.map((p) => [p.id, p])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tournament, repo]);

  const groups = useMemo(() => Array.from(new Set(entries.map((e) => e.group))).sort(), [entries]);
  const teamOptions = useMemo(
    () => Object.values(teams).filter((t) => groupFilter === 'ALL' || t.group === groupFilter).sort((a, b) => a.name.localeCompare(b.name)),
    [teams, groupFilter]
  );
  const playerName = (id: string) => players[id]?.displayName ?? id;

  if (loading) return <Typography color="text.secondary">Loading schedule…</Typography>;
  if (entries.length === 0) return <Typography color="text.secondary">No schedule published yet.</Typography>;

  const filtered = entries.filter((e) => {
    if (groupFilter !== 'ALL' && e.group !== groupFilter) return false;
    if (teamFilter !== 'ALL' && e.team1Id !== teamFilter && e.team2Id !== teamFilter) return false;
    return true;
  });

  const byGroup = filtered.reduce<Record<string, ScheduleEntry[]>>((acc, e) => {
    (acc[e.group] ||= []).push(e);
    return acc;
  }, {});

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Select size="small" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setTeamFilter('ALL'); }} sx={{ minWidth: 160 }}>
          <MenuItem value="ALL">All Groups</MenuItem>
          {groups.map((g) => <MenuItem key={g} value={g}>Group {g}</MenuItem>)}
        </Select>
        <Select size="small" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="ALL">All Teams</MenuItem>
          {teamOptions.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </Select>
      </Stack>

      {Object.keys(byGroup).length === 0 && <Typography color="text.secondary">No matches for this filter.</Typography>}

      {Object.entries(byGroup).map(([group, groupEntries]) => (
        <Stack key={group} spacing={1.5}>
          <Typography variant="h6">Group {group}</Typography>
          <Stack spacing={1.5}>
            {groupEntries.map((e) => (
              <ScheduleRow
                key={e.id}
                entry={e}
                team1Name={teams[e.team1Id]?.name ?? e.team1Id}
                team2Name={teams[e.team2Id]?.name ?? e.team2Id}
                match={e.matchId ? (matches[e.matchId] ?? null) : null}
                lineup1={lineups[lineupDocId(e.id, e.team1Id)] ?? null}
                lineup2={lineups[lineupDocId(e.id, e.team2Id)] ?? null}
                playerName={playerName}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

export default function PublicSchedule() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Schedule" subtitle="Round fixtures, lineups, and scores." />
      <VisibilityGate pageId="schedule">
        <ScheduleContent />
      </VisibilityGate>
    </Container>
  );
}
