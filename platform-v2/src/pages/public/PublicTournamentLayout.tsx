import { useParams, Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import {
  AppBar, Avatar, Badge, Box, Button, Chip, Container, IconButton, Stack, Toolbar,
  Typography, Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import { useClaimPendingInvite } from '@/hooks/useClaimPendingInvite';
import { useNotifications } from '@/hooks/useNotifications';
import { BottomNav } from '@/components/layout/BottomNav';
import { buildTournamentTheme, GRADIENT_PRIMARY } from '@/theme/theme';

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
      <Button
        size="small" variant="contained" component={RouterLink}
        to={`/admin/login?redirect=${encodeURIComponent(location.pathname)}`}
        sx={{ borderRadius: 999, px: 2 }}
      >
        Sign In
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {!roleLoading && (
        <Chip
          size="small"
          label={role ? ROLE_LABELS[role] ?? role : 'No role yet'}
          sx={role ? { backgroundImage: GRADIENT_PRIMARY, color: '#fff' } : undefined}
        />
      )}
      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{user.email}</Typography>
      <Button size="small" onClick={() => signOut()}>Sign Out</Button>
    </Stack>
  );
}

function NotificationsBell({ basePath }: { basePath: string }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return (
    <IconButton component={RouterLink} to={`${basePath}/notifications`} size="small">
      <Badge badgeContent={unreadCount} color="error" max={9}>
        <NotificationsIcon fontSize="small" />
      </Badge>
    </IconButton>
  );
}

// A rounded "pill group" nav — ported from koc3-app's `.top-nav` (rounded gray-blue pill
// container, each link itself a smaller pill, active link filled with the primary
// gradient) — replaces MUI's underlined Tabs, which read as very "default Material" next
// to the rest of the branded shell.
function PillNav({ basePath, currentPath }: { basePath: string; currentPath: string }) {
  return (
    <Stack
      direction="row" spacing={0.5}
      sx={{
        p: 0.5, borderRadius: 999, bgcolor: 'rgba(241,245,249,0.9)', border: '1px solid rgba(226,232,240,0.9)',
        display: { xs: 'none', sm: 'flex' }, overflowX: 'auto',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = currentPath === item.path;
        return (
          <Box
            key={item.pageId}
            component={RouterLink}
            to={`${basePath}/${item.path}`}
            sx={{
              px: 1.7, py: 0.8, borderRadius: 999, fontSize: '0.84rem', fontWeight: 700,
              textDecoration: 'none', whiteSpace: 'nowrap', color: isActive ? '#fff' : 'text.secondary',
              backgroundImage: isActive ? GRADIENT_PRIMARY : 'none',
              boxShadow: isActive ? '0 8px 18px rgba(37,99,235,0.22)' : 'none',
              transition: 'filter 0.12s ease',
              '&:hover': { filter: isActive ? 'brightness(1.05)' : 'none', color: isActive ? '#fff' : 'text.primary' },
            }}
          >
            {item.label}
          </Box>
        );
      })}
    </Stack>
  );
}

function PublicHeader() {
  const { tournament } = useTournament();
  const location = useLocation();
  if (!tournament) return null;
  const { branding, info } = tournament.config;
  const basePath = `/t/${tournament.slug}`;
  const currentPath = NAV_ITEMS.find((n) => location.pathname === `${basePath}/${n.path}`.replace(/\/$/, ''))?.path ?? '';

  return (
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flexGrow: 1 }}>
          {branding.logoUrl ? (
            <Avatar src={branding.logoUrl} variant="rounded" />
          ) : (
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', backgroundImage: GRADIENT_PRIMARY, flexShrink: 0 }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{info.name}</Typography>
        </Stack>
        <PillNav basePath={basePath} currentPath={currentPath} />
        <NotificationsBell basePath={basePath} />
        <AccountStatus />
      </Toolbar>
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
  const { branding } = tournament.config;

  return (
    <ThemeProvider theme={buildTournamentTheme(branding.themeColor, branding.accentColor)}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <PublicHeader />
        {/* Bottom padding keeps content from being hidden behind the fixed mobile bottom nav. */}
        <Box sx={{ pb: { xs: 8, sm: 0 } }}>
          <Outlet />
        </Box>
        <BottomNav basePath={basePath} />
      </Box>
    </ThemeProvider>
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
