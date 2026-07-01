import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { CARD_SHADOW } from '@/theme/theme';

/**
 * The hero header card at the top of every page — ported from koc3-app's `.page-title`
 * (white card, colored left border, title + subtitle). The left border uses the current
 * theme's secondary color so a tournament's configured accentColor (see
 * buildTournamentTheme) actually shows up somewhere prominent, not just on paper.
 */
export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 3,
        borderLeft: '4px solid',
        borderLeftColor: 'secondary.main',
        boxShadow: CARD_SHADOW,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '1.9rem' } }}>{title}</Typography>
          {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
    </Paper>
  );
}
