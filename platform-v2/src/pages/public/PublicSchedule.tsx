import { useEffect, useMemo, useState } from 'react';
import {
  Chip, Container, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { ScheduleEntry, Team } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

function ScheduleContent() {
  const { tournament, repo } = useTournament();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  useEffect(() => {
    // Guard on `tournament` itself, not just the loading flag — see the note in
    // pages/public/PublicTeams.tsx.
    if (!tournament) return;
    let cancelled = false;
    Promise.all([repo<ScheduleEntry>('schedules').list(), repo<Team>('teams').list()]).then(([schedules, teamList]) => {
      if (cancelled) return;
      setEntries(schedules.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
      setTeams(Object.fromEntries(teamList.map((t) => [t.id, t])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tournament, repo]);

  const groups = useMemo(() => Array.from(new Set(entries.map((e) => e.group))).sort(), [entries]);
  const teamOptions = useMemo(
    () => Object.values(teams).filter((t) => groupFilter === 'ALL' || t.group === groupFilter).sort((a, b) => a.name.localeCompare(b.name)),
    [teams, groupFilter]
  );

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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Round</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Match</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupEntries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.round}</TableCell>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.time}</TableCell>
                  <TableCell>{teams[e.team1Id]?.name ?? e.team1Id} vs {teams[e.team2Id]?.name ?? e.team2Id}</TableCell>
                  <TableCell><Chip size="small" label={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
