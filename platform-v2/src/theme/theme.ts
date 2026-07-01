import { createTheme, type Theme } from '@mui/material/styles';

// Design language ported from the live koc3-app: a soft blue-gray page background, white
// rounded cards with a subtle "lift" shadow, a blue -> purple -> magenta gradient used for
// primary actions and card accents, and moderate (not fully pill) corner radii. See
// GRADIENT_PRIMARY / GRADIENT_ACCENT_BAR below, used directly by PageHeader/GradientCard
// since MUI's palette has no slot for a 3-stop gradient.
export const PAGE_BG = '#f0f4fb';
export const GRADIENT_PRIMARY = 'linear-gradient(135deg, #2563eb, #7c3aed 58%, #db2777)';
export const GRADIENT_ACCENT_BAR = 'linear-gradient(90deg, #38bdf8, #2563eb, #7c3aed, #db2777)';
export const CARD_SHADOW = '0 4px 24px rgba(6,14,32,0.10), 0 1px 4px rgba(6,14,32,0.06)';
export const CARD_SHADOW_HOVER = '0 12px 32px rgba(30,58,138,0.16), 0 2px 8px rgba(30,58,138,0.08)';

function buildTheme(primary: string, secondary: string): Theme {
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: primary },
      secondary: { main: secondary },
      background: { default: PAGE_BG, paper: '#ffffff' },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
      button: { fontWeight: 700, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundColor: PAGE_BG } },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 10, minHeight: 40, boxShadow: 'none' },
          containedPrimary: {
            backgroundImage: GRADIENT_PRIMARY,
            boxShadow: '0 4px 14px rgba(37,99,235,0.32)',
            '&:hover': { backgroundImage: GRADIENT_PRIMARY, filter: 'brightness(1.05)', boxShadow: '0 4px 14px rgba(37,99,235,0.32)' },
          },
          outlined: { borderWidth: 2, '&:hover': { borderWidth: 2 } },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16, boxShadow: CARD_SHADOW, border: '1px solid #dde3ee' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          colorDefault: { backgroundColor: '#ffffff' },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 700 } },
      },
    },
  });
}

// Platform-wide default (Tournament Manager, wizard, any admin screen not yet scoped to a
// tournament's own branding).
export const platformTheme = buildTheme('#2563eb', '#f59e0b');

// Per-tournament theme, derived from config.branding.themeColor/accentColor — this is what
// makes the wizard's Branding step (previously a no-op past saving the fields) actually
// change how the public site looks. Falls back to the platform defaults if a tournament
// hasn't set its own colors.
export function buildTournamentTheme(themeColor?: string | null, accentColor?: string | null): Theme {
  return buildTheme(themeColor || '#2563eb', accentColor || '#f59e0b');
}
