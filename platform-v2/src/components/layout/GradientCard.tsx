import type { ReactNode } from 'react';
import { Card, type CardProps } from '@mui/material';
import { GRADIENT_ACCENT_BAR, CARD_SHADOW_HOVER } from '@/theme/theme';

/**
 * A Card with the sky -> blue -> purple -> magenta top accent bar ported from koc3-app's
 * `.card::before`, plus the same hover "lift" — used for nav tiles, list items, and content
 * sections that want more visual interest than a plain Paper.
 */
export function GradientCard({ children, sx, ...props }: CardProps & { children: ReactNode }) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 4,
          backgroundImage: GRADIENT_ACCENT_BAR,
        },
        '&:hover': { transform: 'translateY(-2px)', boxShadow: CARD_SHADOW_HOVER },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Card>
  );
}
