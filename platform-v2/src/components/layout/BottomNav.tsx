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

// Mobile-first bottom tab bar, matching koc3-app's fixed 5-tab layout (a top indicator bar
// above the active icon, colored active state) — shown only on small screens (sm+ uses the
// PillNav bar in PublicTournamentLayout instead).
export function BottomNav({ basePath }: { basePath: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((t) => location.pathname === `${basePath}/${t.path}`.replace(/\/$/, ''))?.path ?? '';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        display: { xs: 'block', sm: 'none' },
        borderTop: '1px solid', borderColor: 'divider',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.09)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation value={current} onChange={(_, value) => navigate(`${basePath}/${value}`)} showLabels sx={{ height: 64 }}>
        {TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.path} label={tab.label} value={tab.path} icon={tab.icon}
            sx={{
              position: 'relative', minWidth: 0,
              '&.Mui-selected': {
                color: 'primary.main',
                '&::before': {
                  content: '""', position: 'absolute', top: 0, left: '25%', right: '25%',
                  height: 3, borderRadius: '0 0 4px 4px', bgcolor: 'primary.main',
                },
              },
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
