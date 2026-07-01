import type { ReactNode } from 'react';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { CARD_SHADOW, GRADIENT_PRIMARY } from '@/theme/theme';

/**
 * Shared shell for the sign-in/sign-up screens — a centered branded card on a full-height
 * page background, replacing the previous bare unstyled Paper (no logo, no page
 * background, default MUI everything). Ported from koc3-app's `.login-card` treatment.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 4, boxShadow: CARD_SHADOW }}>
          <Stack spacing={2.5} alignItems="center" sx={{ mb: 3 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '14px', backgroundImage: GRADIENT_PRIMARY, boxShadow: '0 8px 20px rgba(37,99,235,0.35)' }} />
            <Box textAlign="center">
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{title}</Typography>
              {subtitle && <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
            </Box>
          </Stack>
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
