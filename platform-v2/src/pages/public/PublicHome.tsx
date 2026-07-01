import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

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

function HomeContent() {
  const { tournament } = useTournament();
  if (!tournament) return null;
  const { info, structure } = tournament.config;

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
