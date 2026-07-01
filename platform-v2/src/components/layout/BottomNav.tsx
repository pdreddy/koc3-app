import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EventIcon from '@mui/icons-material/Event';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import EditNoteIcon from '@mui/icons-material/EditNote';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '', label: 'Home', icon: <HomeIcon /> },
  { path: 'schedule', label: 'Schedule', icon: <EventIcon /> },
  { path: 'standings', label: 'Standings', icon: <LeaderboardIcon /> },
  { path: 'score', label: 'Score', icon: <EditNoteIcon /> },
  { path: 'more', label: 'More', icon: <MoreHorizIcon /> },
];

// Mobile-first bottom tab bar, matching koc3-app's fixed 5-tab layout — shown only on
// small screens (sm+ uses the top Tabs bar in PublicTournamentLayout instead).
export function BottomNav({ basePath }: { basePath: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((t) => location.pathname === `${basePath}/${t.path}`.replace(/\/$/, ''))?.path ?? '';

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        display: { xs: 'block', sm: 'none' },
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation value={current} onChange={(_, value) => navigate(`${basePath}/${value}`)} showLabels>
        {TABS.map((tab) => (
          <BottomNavigationAction key={tab.path} label={tab.label} value={tab.path} icon={tab.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
