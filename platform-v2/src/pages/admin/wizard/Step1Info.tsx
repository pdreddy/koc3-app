import React from 'react';
import { Grid, Stack, TextField, Typography } from '@mui/material';
import type { TournamentInfo } from '@/types';

export default function Step1Info({
  value,
  onChange,
}: {
  value: TournamentInfo;
  onChange: (patch: Partial<TournamentInfo>) => void;
}) {
  const field = (key: keyof TournamentInfo) => ({
    value: (value[key] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value }),
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Tournament Information</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField fullWidth required label="Tournament Name" {...field('name')} /></Grid>
        <Grid item xs={12} sm={3}><TextField fullWidth label="Season" {...field('season')} /></Grid>
        <Grid item xs={12} sm={3}><TextField fullWidth label="Short Name" {...field('shortName')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Club Name" {...field('clubName')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="League Name" {...field('leagueName')} /></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Description" {...field('description')} /></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={4} label="Rules" placeholder="Published on the public Rules page" {...field('rulesText')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Location" {...field('location')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Organizer" {...field('organizer')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth type="email" label="Contact Email" {...field('contactEmail')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Website" {...field('website')} /></Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="date" label="Tournament Start" InputLabelProps={{ shrink: true }}
            value={value.startsAt ? new Date(value.startsAt).toISOString().slice(0, 10) : ''}
            onChange={(e) => onChange({ startsAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="date" label="Tournament End" InputLabelProps={{ shrink: true }}
            value={value.endsAt ? new Date(value.endsAt).toISOString().slice(0, 10) : ''}
            onChange={(e) => onChange({ endsAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="date" label="Registration Opens" InputLabelProps={{ shrink: true }}
            value={value.registrationOpensAt ? new Date(value.registrationOpensAt).toISOString().slice(0, 10) : ''}
            onChange={(e) => onChange({ registrationOpensAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="date" label="Registration Closes" InputLabelProps={{ shrink: true }}
            value={value.registrationClosesAt ? new Date(value.registrationClosesAt).toISOString().slice(0, 10) : ''}
            onChange={(e) => onChange({ registrationClosesAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="number" label="Maximum Registrations"
            value={value.maxRegistrations ?? ''}
            onChange={(e) => onChange({ maxRegistrations: e.target.value ? Number(e.target.value) : null })} />
        </Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Timezone" {...field('timezone')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth type="color" label="Primary Color" {...field('primaryColor')} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth type="color" label="Secondary Color" {...field('secondaryColor')} /></Grid>
      </Grid>
    </Stack>
  );
}
