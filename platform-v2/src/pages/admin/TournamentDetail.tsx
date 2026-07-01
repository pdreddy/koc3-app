import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { TournamentService } from '@/services/TournamentService';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

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

  const setupLinks = [
    { to: 'import-players', icon: '📋', label: 'Import Players', desc: 'CSV/JSON roster upload' },
    { to: 'generate-teams', icon: '👥', label: 'Generate Teams', desc: 'Random or UTR-balanced' },
    { to: 'generate-schedule', icon: '📅', label: 'Generate Schedule', desc: 'Round-robin fixtures' },
    { to: 'generate-playoffs', icon: '🏆', label: 'Generate Playoffs', desc: 'Knockout bracket' },
    { to: 'roles', icon: '🔑', label: 'Team Roles', desc: 'Invite captains & organizers' },
    { to: 'edit', icon: '⚙️', label: 'Settings', desc: 'Every wizard step, revisited' },
    { to: 'audit', icon: '🗒️', label: 'Audit Log', desc: 'Every notable action' },
    { to: 'content', icon: '📣', label: 'Content', desc: 'Announcements, sponsors, gallery' },
    { to: 'approve-scores', icon: '✅', label: 'Approve Scores', desc: 'Review pending submissions' },
    { to: 'analytics', icon: '📊', label: 'Analytics', desc: 'Activity & leaderboards' },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title={<Stack direction="row" spacing={1.5} alignItems="center">{config.info.name}<Chip label={tournament.status} size="small" /></Stack>}
        subtitle={<><Link component={RouterLink} to={publicUrl}>{publicUrl}</Link> · {config.type.replaceAll('_', ' ')}</>}
        action={tournament.status !== 'PUBLISHED' ? <Button variant="contained" onClick={handlePublish}>Publish</Button> : undefined}
      />
      {tournament.status !== 'PUBLISHED' && (
        <Alert severity="info">This tournament is a draft — the public site won't be visible until it's published.</Alert>
      )}

      <Typography variant="h6">Setup</Typography>
      <Grid container spacing={2}>
        {setupLinks.map((link) => (
          <Grid item xs={6} sm={4} md={3} key={link.to}>
            <GradientCard sx={{ height: '100%' }}>
              <Box
                component={RouterLink}
                to={`/admin/tournaments/${tournament.id}/${link.to}`}
                sx={{ display: 'block', p: 2, textDecoration: 'none', color: 'inherit', pt: 2.5 }}
              >
                <Typography sx={{ fontSize: '1.5rem' }}>{link.icon}</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>{link.label}</Typography>
                <Typography variant="caption" color="text.secondary">{link.desc}</Typography>
              </Box>
            </GradientCard>
          </Grid>
        ))}
      </Grid>

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
