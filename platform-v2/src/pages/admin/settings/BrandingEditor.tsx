import { Grid, Stack, TextField, Typography } from '@mui/material';
import type { BrandingConfig } from '@/types';

export default function BrandingEditor({ value, onChange }: { value: BrandingConfig; onChange: (patch: Partial<BrandingConfig>) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Branding</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Logo URL" value={value.logoUrl ?? ''} onChange={(e) => onChange({ logoUrl: e.target.value || null })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Banner URL" value={value.bannerUrl ?? ''} onChange={(e) => onChange({ bannerUrl: e.target.value || null })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Background URL" value={value.backgroundUrl ?? ''} onChange={(e) => onChange({ backgroundUrl: e.target.value || null })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Club Logo URL" value={value.clubLogoUrl ?? ''} onChange={(e) => onChange({ clubLogoUrl: e.target.value || null })} /></Grid>
        <Grid item xs={6} sm={3}><TextField fullWidth type="color" label="Theme Color" value={value.themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} /></Grid>
        <Grid item xs={6} sm={3}><TextField fullWidth type="color" label="Accent Color" value={value.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Font Family" value={value.fontFamily ?? ''} onChange={(e) => onChange({ fontFamily: e.target.value || null })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Favicon URL" value={value.faviconUrl ?? ''} onChange={(e) => onChange({ faviconUrl: e.target.value || null })} /></Grid>
      </Grid>
    </Stack>
  );
}
