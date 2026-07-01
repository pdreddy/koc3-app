import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Button, CardContent, Container, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Match, PlayoffMatch, ScheduleEntry, Team } from '@/types';
import { writeAuditLog } from '@/services/auditService';
import { advancePlayoffWinner } from '@/services/playoffBracketGenerator';
import { notify } from '@/services/notificationService';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

function setScoreLabel(set: { team1: number; team2: number; tiebreak?: { team1: number; team2: number }; matchTiebreak?: { team1: number; team2: number } }): string {
  if (set.matchTiebreak) return `[${set.matchTiebreak.team1}-${set.matchTiebreak.team2}]`;
  const base = `${set.team1}-${set.team2}`;
  return set.tiebreak ? `${base}(${Math.min(set.tiebreak.team1, set.tiebreak.team2)})` : base;
}

function ApproveScoresContent() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const [pending, setPending] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    const [matches, teamList] = await Promise.all([repo<Match>('matches').list(), repo<Team>('teams').list()]);
    setPending(matches.filter((m) => m.status === 'PENDING_APPROVAL'));
    setTeams(Object.fromEntries(teamList.map((t) => [t.id, t])));
    setLoading(false);
  };

  useEffect(() => { if (tournament) reload(); }, [tournament, repo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tournament) return null;

  const handleApprove = async (match: Match) => {
    setBusyId(match.id);
    await repo<Match>('matches').update(match.id, { status: 'APPROVED', approvedBy: user?.uid ?? null, updatedAt: Date.now() });
    // A playoff bracket slot's winner only advances into the next round once its Match is
    // trusted (APPROVED) — a captain's PENDING_APPROVAL submission just linked matchId
    // (see ScoreEntry.tsx), it never touched winnerTeamId/nextMatchId itself.
    if (match.playoffMatchId && match.winnerTeamId) {
      const playoffMatch = await repo<PlayoffMatch>('playoffMatches').get(match.playoffMatchId);
      if (playoffMatch) await advancePlayoffWinner(repo, playoffMatch, match.winnerTeamId, match.id);
    }
    await writeAuditLog(tournament.id, 'SCORE_APPROVED', { uid: user?.uid ?? 'unknown', email: user?.email ?? null }, 'match', match.id, {});
    if (user) {
      const label = `${teams[match.team1Id]?.name ?? match.team1Id} vs ${teams[match.team2Id]?.name ?? match.team2Id}`;
      await Promise.all([
        notify(repo, `TEAM_${match.team1Id}`, 'SCORE_APPROVED', 'Score approved', `${label} — score approved.`, null, user.uid),
        notify(repo, `TEAM_${match.team2Id}`, 'SCORE_APPROVED', 'Score approved', `${label} — score approved.`, null, user.uid),
      ]);
    }
    setBusyId(null);
    reload();
  };

  const handleReject = async (match: Match) => {
    setBusyId(match.id);
    // Rejecting deletes the match entirely and reopens the schedule entry / playoff slot so
    // the captain can resubmit, rather than leaving a permanently-disputed record around.
    await repo<Match>('matches').remove(match.id);
    if (match.scheduleEntryId) {
      await repo<ScheduleEntry>('schedules').update(match.scheduleEntryId, { status: 'SCHEDULED', matchId: null });
    }
    if (match.playoffMatchId) {
      await repo<PlayoffMatch>('playoffMatches').update(match.playoffMatchId, { matchId: null });
    }
    await writeAuditLog(tournament.id, 'SCORE_REJECTED', { uid: user?.uid ?? 'unknown', email: user?.email ?? null }, 'match', match.id, {});
    if (user) {
      const label = `${teams[match.team1Id]?.name ?? match.team1Id} vs ${teams[match.team2Id]?.name ?? match.team2Id}`;
      await Promise.all([
        notify(repo, `TEAM_${match.team1Id}`, 'SCORE_REJECTED', 'Score rejected', `${label} — score rejected, please resubmit.`, null, user.uid),
        notify(repo, `TEAM_${match.team2Id}`, 'SCORE_REJECTED', 'Score rejected', `${label} — score rejected, please resubmit.`, null, user.uid),
      ]);
    }
    setBusyId(null);
    reload();
  };

  if (loading) return <Typography color="text.secondary">Loading pending scores…</Typography>;
  if (pending.length === 0) return <Typography color="text.secondary">No scores waiting for approval.</Typography>;

  return (
    <Stack spacing={2}>
      {pending.map((match) => (
        <GradientCard key={match.id}>
          <CardContent>
            <Typography variant="subtitle1">
              {teams[match.team1Id]?.name ?? match.team1Id} vs {teams[match.team2Id]?.name ?? match.team2Id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Winner: {teams[match.winnerTeamId ?? '']?.name ?? '—'}
            </Typography>
            <Table size="small" sx={{ mt: 1 }}>
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
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Button variant="contained" color="success" disabled={busyId === match.id} onClick={() => handleApprove(match)}>Approve</Button>
              <Button variant="outlined" color="error" disabled={busyId === match.id} onClick={() => handleReject(match)}>Reject</Button>
            </Stack>
          </CardContent>
        </GradientCard>
      ))}
    </Stack>
  );
}

export default function ApproveScores() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageHeader title="Approve Scores" subtitle="Review and approve or reject captain-submitted scores." />
      <TournamentProvider tournamentId={tournamentId}>
        <ApproveScoresContent />
      </TournamentProvider>
    </Container>
  );
}
