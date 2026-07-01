import { useParams } from 'react-router-dom';
import { Alert, Chip, Container, Divider, Stack, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';

// Stub detail view: confirms the wizard actually persisted a real, loadable tournament
// document. Full admin screens (roster import, team/schedule generators, settings editor,
// visibility control) are follow-on increments — see Tasks #7-#9 in the plan.
function TournamentDetailInner() {
  const { tournament, loading, error } = useTournament();

  if (loading) return <Typography color="text.secondary">Loading tournament…</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!tournament) return null;

  const { config } = tournament;
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h4">{config.info.name}</Typography>
        <Chip label={tournament.status} size="small" />
      </Stack>
      <Typography color="text.secondary">/t/{tournament.slug} · {config.type.replaceAll('_', ' ')}</Typography>
      <Divider />
      <Typography variant="h6">Structure</Typography>
      <Typography>
        {config.structure.groupCount} groups · {config.structure.teamCount} teams ·{' '}
        {config.structure.playersPerTeam} players/team
      </Typography>
      <Typography variant="h6">Scoring</Typography>
      <Typography>
        {config.scoring.setFormat.replaceAll('_', ' ')} · best of {config.scoring.setsToWin === 2 ? 3 : config.scoring.setsToWin * 2 - 1} ·{' '}
        {config.scoring.adRule === 'NO_AD' ? 'No-Ad' : 'Advantage'}
      </Typography>
      <Typography variant="h6">Playoffs</Typography>
      <Typography>
        {config.playoffs.enabled ? `Top ${config.playoffs.qualifyPerGroup} per group qualify` : 'No playoffs'}
      </Typography>
      <Alert severity="info">
        Roster import, team/schedule generation, and settings editing aren't built yet — this is a
        read-only confirmation that tournament creation and Firestore loading both work end-to-end.
      </Alert>
    </Stack>
  );
}

export default function TournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <TournamentDetailInner />
      </TournamentProvider>
    </Container>
  );
}
