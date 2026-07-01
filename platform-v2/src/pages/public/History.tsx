import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Chip, Container, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Match, Player, Team } from '@/types';

function setScoreLabel(set: { team1: number; team2: number; tiebreak?: { team1: number; team2: number }; matchTiebreak?: { team1: number; team2: number } }): string {
  if (set.matchTiebreak) return `[${set.matchTiebreak.team1}-${set.matchTiebreak.team2}]`;
  const base = `${set.team1}-${set.team2}`;
  return set.tiebreak ? `${base}(${Math.min(set.tiebreak.team1, set.tiebreak.team2)})` : base;
}

function HistoryContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    Promise.all([repo<Match>('matches').list(), repo<Team>('teams').list(), repo<Player>('players').list()]).then(
      ([m, t, p]) => {
        setMatches(m.filter((x) => x.status === 'APPROVED').sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0)));
        setTeams(Object.fromEntries(t.map((tm) => [tm.id, tm])));
        setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
        setLoading(false);
      }
    );
  }, [repo, tournamentLoading]);

  const playerName = (id: string) => players[id]?.displayName ?? id;

  if (loading) return <Typography color="text.secondary">Loading history…</Typography>;
  if (matches.length === 0) return <Typography color="text.secondary">No completed matches yet.</Typography>;

  return (
    <Stack spacing={1}>
      {matches.map((match) => {
        const team1 = teams[match.team1Id];
        const team2 = teams[match.team2Id];
        const winner = teams[match.winnerTeamId ?? ''];
        return (
          <Accordion key={match.id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <Typography sx={{ flexGrow: 1 }}>{team1?.name ?? match.team1Id} vs {team2?.name ?? match.team2Id}</Typography>
                {winner && <Chip size="small" color="success" label={`${winner.name} won`} />}
                <Typography variant="body2" color="text.secondary">
                  {match.playedAt ? new Date(match.playedAt).toLocaleDateString() : ''}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Line</TableCell><TableCell>{team1?.name}</TableCell><TableCell>{team2?.name}</TableCell><TableCell>Sets</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {match.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell>{line.team1PlayerIds.map(playerName).join(' / ')}</TableCell>
                      <TableCell>{line.team2PlayerIds.map(playerName).join(' / ')}</TableCell>
                      <TableCell>{line.sets.map(setScoreLabel).join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}

export default function History() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Match History</Typography>
      <VisibilityGate pageId="history">
        <HistoryContent />
      </VisibilityGate>
    </Container>
  );
}
