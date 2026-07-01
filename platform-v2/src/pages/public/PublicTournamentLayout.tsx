import { useParams, Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Avatar, Box, Container, Tab, Tabs, Toolbar, Typography, Alert } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';

const NAV_ITEMS: { pageId: string; label: string; path: string }[] = [
  { pageId: 'home', label: 'Home', path: '' },
  { pageId: 'schedule', label: 'Schedule', path: 'schedule' },
  { pageId: 'standings', label: 'Standings', path: 'standings' },
  { pageId: 'teams', label: 'Teams', path: 'teams' },
  { pageId: 'rules', label: 'Rules', path: 'rules' },
];

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
      </Toolbar>
      <Tabs value={currentTab} variant="scrollable" scrollButtons="auto">
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

  if (loading) return <Container sx={{ py: 6 }}><Typography color="text.secondary">Loading…</Typography></Container>;
  if (error || !tournament) return <Container sx={{ py: 6 }}><Alert severity="error">{error || 'Tournament not found'}</Alert></Container>;
  if (tournament.status !== 'PUBLISHED') {
    return <Container sx={{ py: 6 }}><Alert severity="info">This tournament hasn't been published yet.</Alert></Container>;
  }

  return (
    <Box>
      <PublicHeader />
      <Outlet />
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
