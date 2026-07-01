import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Container, Stack, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { Match, PlayoffMatch, Team } from '@/types';
import { computeStandings, groupStandings } from '@/services/standingsEngine';
import { generatePlayoffBracket } from '@/services/playoffBracketGenerator';
import { writeAuditLog } from '@/services/auditService';
import { notify } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';

function GeneratePlayoffsContent() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [existing, setExisting] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([repo<Team>('teams').list(), repo<Match>('matches').list(), repo<PlayoffMatch>('playoffMatches').list()]).then(
      ([t, m, p]) => { setTeams(t); setMatches(m); setExisting(p); setLoading(false); }
    );
  }, [tournament, repo]);

  if (!tournament) return null;
  if (!tournament.config.playoffs.enabled) {
    return <Alert severity="warning">Playoffs aren't enabled for this tournament — turn them on in Settings first.</Alert>;
  }

  // Ranks each group's standings and takes the top qualifyPerGroup, then interleaves
  // group-by-group (A1, B1, C1, ..., A2, B2, ...) so the seeding pass in the generator
  // doesn't stack every seed from the same group at the top.
  const qualified = (() => {
    const rows = computeStandings(teams, matches, tournament.config.standings);
    const byGroup = groupStandings(rows);
    const groupNames = Object.keys(byGroup).sort();
    const qualifyTop = tournament.config.playoffs.qualifyPerGroup;
    const out: Team[] = [];
    for (let rank = 0; rank < qualifyTop; rank++) {
      groupNames.forEach((g) => {
        const row = byGroup[g][rank];
        if (row) out.push(row.team);
      });
    }
    return out;
  })();

  const handleGenerate = async () => {
    setGenerating(true);
    const now = Date.now();
    const bracket = generatePlayoffBracket(qualified, tournament.config.playoffs, now);
    const playoffRepo = repo<PlayoffMatch>('playoffMatches');
    await Promise.all(bracket.map((m) => playoffRepo.setWithId(m.id, m)));
    if (user) {
      await writeAuditLog(tournament.id, 'PLAYOFFS_GENERATED', { uid: user.uid, email: user.email }, 'tournament', tournament.id, { entrants: qualified.length });
      await notify(repo, 'ALL', 'PLAYOFFS_GENERATED', 'Playoff bracket is set', `The ${bracket.length}-match playoff bracket has been generated.`, `/t/${tournament.slug}/playoffs`, user.uid);
    }
    setExisting(bracket);
    setGenerating(false);
    setResult(`Generated a ${bracket.length}-match bracket from ${qualified.length} qualified teams.`);
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="Generate Playoffs" subtitle="Seed a single-elimination bracket from group standings." />
      {loading ? (
        <Typography color="text.secondary">Loading standings…</Typography>
      ) : qualified.length < 2 ? (
        <Alert severity="warning">Not enough teams have qualified yet — play more group matches first.</Alert>
      ) : (
        <>
          <Typography>
            {qualified.length} team{qualified.length === 1 ? '' : 's'} qualified (top {tournament.config.playoffs.qualifyPerGroup} per group):{' '}
            {qualified.map((t) => t.name).join(', ')}
          </Typography>
          {existing.length > 0 && (
            <Alert severity="info">
              A bracket already exists ({existing.length} matches). Generating again overwrites it, resetting any scores already entered in it.
            </Alert>
          )}
          {result && <Alert severity="success">{result}</Alert>}
          <Stack direction="row" spacing={2}>
            <Button variant="contained" disabled={generating} onClick={handleGenerate}>
              {generating ? 'Generating…' : existing.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}
            </Button>
            <Button onClick={() => navigate(`/t/${tournament.slug}/playoffs`)}>View Bracket</Button>
            {result && <Button onClick={() => navigate(`/admin/tournaments/${tournamentId}`)}>Back to Tournament</Button>}
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default function GeneratePlayoffs() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <GeneratePlayoffsContent />
      </TournamentProvider>
    </Container>
  );
}
