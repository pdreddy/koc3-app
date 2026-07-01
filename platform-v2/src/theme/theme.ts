import { createTheme } from '@mui/material/styles';

// Platform-level default theme, used for the Tournament Manager / wizard / any admin
// screen that isn't scoped to a specific tournament yet. Once a tournament is loaded, its
// own branding.themeColor/accentColor should build a derived theme (see useTournamentTheme
// once the public site — Task #10 — needs it); not needed for the admin-only screens built
// in this first slice.
export const platformTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' },
    secondary: { main: '#f59e0b' },
  },
  shape: { borderRadius: 10 },
});
