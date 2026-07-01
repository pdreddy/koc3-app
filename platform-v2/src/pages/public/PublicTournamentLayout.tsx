import { useParams, Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Avatar, Box, Button, Chip, Container, Stack, Tab, Tabs, Toolbar, Typography, Alert } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import { useClaimPendingInvite } from '@/hooks/useClaimPendingInvite';
import { BottomNav } from '@/components/layout/BottomNav';

// Primary nav stays short (koc3-app collapses secondary pages into a "More" screen rather
// than a long tab bar) — History/Matchups/Ratings/Rules live behind More.
const NAV_ITEMS: { pageId: string; label: string; path: string }[] = [
  { pageId: 'home', label: 'Home', path: '' },
  { pageId: 'schedule', label: 'Schedule', path: 'schedule' },
  { pageId: 'standings', label: 'Standings', path: 'standings' },
  { pageId: 'teams', label: 'Teams', path: 'teams' },
  { pageId: 'lineupSubmission', label: 'Lineup', path: 'lineup' },
  { pageId: 'scoreEntry', label: 'Enter Score', path: 'score' },
  { pageId: 'more', label: 'More', path: 'more' },
];

const ROLE_LABELS: Record<string, string> = {
  TOURNAMENT_ADMIN: 'Admin', ORGANIZER: 'Organizer', CAPTAIN: 'Captain',
  VICE_CAPTAIN: 'Vice Captain', PLAYER: 'Player',
};

function AccountStatus() {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading } = useTournamentRole();
  const location = useLocation();

  if (!user) {
    return (
      <Button size="small" component={RouterLink} to={`/admin/login?redirect=${encodeURIComponent(location.pathname)}`}>
        Sign In
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {!roleLoading && (
        <Chip size="small" label={role ? ROLE_LABELS[role] ?? role : 'No role yet'} color={role ? 'primary' : 'default'} />
      )}
      <Typography variant="body2" color="text.secondary">{user.email}</Typography>
      <Button size="small" onClick={() => signOut()}>Sign Out</Button>
    </Stack>
  );
}

function PublicHeader() {
  const { tournament } = useTournament();
  const location = useLocation();
  if (!tournament) return null;
  const { branding, info } = tournament.config;
  const basePath = `/t/${tournament.slug}`;
  const currentTab = NAV_ITEMS.find((n) => location.pathname === `${basePath}/${n.path}`.replace(/\/$/, ''))?.path ?? '';

  return (
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar>
        {branding.logoUrl && <Avatar src={branding.logoUrl} sx={{ mr: 1.5 }} variant="rounded" />}
        <Typography variant="h6" sx={{ flexGrow: 1 }}>{info.name}</Typography>
        <AccountStatus />
      </Toolbar>
      <Tabs value={currentTab} variant="scrollable" scrollButtons="auto" sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {NAV_ITEMS.map((item) => (
          <Tab
            key={item.pageId}
            value={item.path}
            label={item.label}
            component={RouterLink}
            to={`${basePath}/${item.path}`}
          />
        ))}
      </Tabs>
    </AppBar>
  );
}

function PublicTournamentShell() {
  const { tournament, loading, error } = useTournament();
  // Hooks must run unconditionally on every render — useClaimPendingInvite itself no-ops
  // until both a signed-in user and a loaded tournament are available, so it's safe to
  // call before the loading/error early-returns below.
  useClaimPendingInvite();

  if (loading) return <Container sx={{ py: 6 }}><Typography color="text.secondary">Loading…</Typography></Container>;
  if (error || !tournament) return <Container sx={{ py: 6 }}><Alert severity="error">{error || 'Tournament not found'}</Alert></Container>;
  if (tournament.status !== 'PUBLISHED') {
    return <Container sx={{ py: 6 }}><Alert severity="info">This tournament hasn't been published yet.</Alert></Container>;
  }

  const basePath = `/t/${tournament.slug}`;
  return (
    <Box>
      <PublicHeader />
      {/* Bottom padding keeps content from being hidden behind the fixed mobile bottom nav. */}
      <Box sx={{ pb: { xs: 8, sm: 0 } }}>
        <Outlet />
      </Box>
      <BottomNav basePath={basePath} />
    </Box>
  );
}

export default function PublicTournamentLayout() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Alert severity="error">Missing tournament slug</Alert>;
  return (
    <TournamentProvider slug={slug}>
      <PublicTournamentShell />
    </TournamentProvider>
  );
}
