import { useEffect, useState } from 'react';
import {
  Avatar, Button, CardContent, Chip, Collapse, Container, Grid, Stack, Table, TableBody,
  TableCell, TableRow, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Player, Team } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

function avgUtr(players: Player[]): string | null {
  const rated = players.filter((p) => p.utrRating != null);
  if (rated.length === 0) return null;
  const avg = rated.reduce((sum, p) => sum + (p.utrRating ?? 0), 0) / rated.length;
  return avg.toFixed(2);
}

function TeamCard({ team, players, expanded, onToggle }: { team: Team; players: Player[]; expanded: boolean; onToggle: () => void }) {
  const avg = avgUtr(players);
  return (
    <GradientCard>
      <CardContent sx={{ pt: 2.5, cursor: 'pointer' }} onClick={onToggle}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={team.logoUrl ?? undefined}>{team.abbreviation?.slice(0, 2)}</Avatar>
            <div>
              <Typography variant="subtitle1">{team.name}</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                <Chip size="small" label={`${players.length} players`} />
                {team.group && <Chip size="small" label={`Group ${team.group}`} />}
                {avg && <Chip size="small" label={`Avg UTR ${avg}`} />}
              </Stack>
            </div>
          </Stack>
          {expanded ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />}
        </Stack>
        <Collapse in={expanded} onClick={(e) => e.stopPropagation()}>
          <Table size="small" sx={{ mt: 1.5 }}>
            <TableBody>
              {players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.isCaptain ? '© ' : p.isViceCaptain ? 'VC ' : ''}{p.displayName}
                  </TableCell>
                  <TableCell align="right">{p.utrRating != null ? p.utrRating.toFixed(2) : '—'}</TableCell>
                </TableRow>
              ))}
              {players.length === 0 && <TableRow><TableCell><Typography color="text.secondary" variant="body2">No players yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Collapse>
      </CardContent>
    </GradientCard>
  );
}

function TeamsContent() {
  const { tournament, repo } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Guard on `tournament` itself, not just the loading flag — loading becomes false in
    // the error case too (e.g. tournament not found), when tournament is still null and
    // repo() would throw.
    if (!tournament) return;
    Promise.all([repo<Team>('teams').list(), repo<Player>('players').list()]).then(([t, p]) => {
      setTeams(t);
      setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
      setLoading(false);
    });
  }, [tournament, repo]);

  if (loading) return <Typography color="text.secondary">Loading teams…</Typography>;
  if (teams.length === 0) return <Typography color="text.secondary">No teams yet.</Typography>;

  const byGroup = teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = t.group ?? 'Unassigned';
    (acc[key] ||= []).push(t);
    return acc;
  }, {});

  const expandAll = () => setExpanded(Object.fromEntries(teams.map((t) => [t.id, true])));
  const collapseAll = () => setExpanded({});

  return (
    <Stack spacing={4}>
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={expandAll}>Expand All</Button>
        <Button size="small" onClick={collapseAll}>Collapse All</Button>
      </Stack>
      {Object.entries(byGroup).map(([group, groupTeams]) => (
        <Stack key={group} spacing={1.5}>
          <Typography variant="h6">Group {group}</Typography>
          <Grid container spacing={2}>
            {groupTeams.map((team) => (
              <Grid item xs={12} sm={6} md={4} key={team.id}>
                <TeamCard
                  team={team}
                  players={team.playerIds.map((id) => players[id]).filter((p): p is Player => Boolean(p))}
                  expanded={Boolean(expanded[team.id])}
                  onToggle={() => setExpanded((prev) => ({ ...prev, [team.id]: !prev[team.id] }))}
                />
              </Grid>
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}

export default function PublicTeams() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Teams" subtitle="Rosters, captains, and team groups." />
      <VisibilityGate pageId="teams">
        <TeamsContent />
      </VisibilityGate>
    </Container>
  );
}
