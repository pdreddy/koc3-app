import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Button, Chip, Container, Divider, Link, Stack, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { TournamentService } from '@/services/TournamentService';
import { useAuth } from '@/contexts/AuthContext';

// Confirms the wizard actually persisted a real, loadable tournament document, and links
// out to the setup actions (import players / generate teams / generate schedule). A full
// settings editor (wizard steps 4-10 revisited, branding, visibility) is still a follow-on.
function TournamentDetailInner() {
  const { tournament, loading, error } = useTournament();
  const { user } = useAuth();

  if (loading) return <Typography color="text.secondary">Loading tournament…</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!tournament) return null;

  const { config } = tournament;
  const publicUrl = `/t/${tournament.slug}`;

  const handlePublish = async () => {
    await TournamentService.publish(tournament.id, user?.uid || 'unknown');
    window.location.reload();
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h4">{config.info.name}</Typography>
        <Chip label={tournament.status} size="small" />
      </Stack>
      <Typography color="text.secondary">
        <Link component={RouterLink} to={publicUrl}>{publicUrl}</Link> · {config.type.replaceAll('_', ' ')}
      </Typography>
      {tournament.status !== 'PUBLISHED' && (
        <Alert severity="info" action={<Button size="small" onClick={handlePublish}>Publish</Button>}>
          This tournament is a draft — the public site won't be visible until it's published.
        </Alert>
      )}
      <Divider />

      <Typography variant="h6">Setup</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/import-players`}>
          Import Players
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/generate-teams`}>
          Generate Teams
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/generate-schedule`}>
          Generate Schedule
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/roles`}>
          Team Roles
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/edit`}>
          Settings
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/audit`}>
          Audit Log
        </Button>
        <Button variant="outlined" component={RouterLink} to={`/admin/tournaments/${tournament.id}/content`}>
          Content
        </Button>
      </Stack>

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
