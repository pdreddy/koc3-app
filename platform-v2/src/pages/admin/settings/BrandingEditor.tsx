import { Grid, Stack, TextField, Typography } from '@mui/material';
import type { BrandingConfig } from '@/types';
import { ImageUploadField } from '@/components/ImageUploadField';

export default function BrandingEditor({
  value, onChange, tournamentId,
}: { value: BrandingConfig; onChange: (patch: Partial<BrandingConfig>) => void; tournamentId: string }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Branding</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <ImageUploadField label="Logo URL" value={value.logoUrl ?? ''} onChange={(url) => onChange({ logoUrl: url || null })} tournamentId={tournamentId} storagePath="branding/logo" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ImageUploadField label="Banner URL" value={value.bannerUrl ?? ''} onChange={(url) => onChange({ bannerUrl: url || null })} tournamentId={tournamentId} storagePath="branding/banner" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ImageUploadField label="Background URL" value={value.backgroundUrl ?? ''} onChange={(url) => onChange({ backgroundUrl: url || null })} tournamentId={tournamentId} storagePath="branding/background" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ImageUploadField label="Club Logo URL" value={value.clubLogoUrl ?? ''} onChange={(url) => onChange({ clubLogoUrl: url || null })} tournamentId={tournamentId} storagePath="branding/clubLogo" />
        </Grid>
        <Grid item xs={6} sm={3}><TextField fullWidth type="color" label="Theme Color" value={value.themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} /></Grid>
        <Grid item xs={6} sm={3}><TextField fullWidth type="color" label="Accent Color" value={value.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Font Family" value={value.fontFamily ?? ''} onChange={(e) => onChange({ fontFamily: e.target.value || null })} /></Grid>
        <Grid item xs={12} sm={6}>
          <ImageUploadField label="Favicon URL" value={value.faviconUrl ?? ''} onChange={(url) => onChange({ faviconUrl: url || null })} tournamentId={tournamentId} storagePath="branding/favicon" />
        </Grid>
      </Grid>
    </Stack>
  );
}
