import { FormControlLabel, Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import type { TournamentStructure } from '@/types';

export default function Step3Structure({
  value,
  onChange,
}: {
  value: TournamentStructure;
  onChange: (patch: Partial<TournamentStructure>) => void;
}) {
  const numberField = (key: keyof TournamentStructure, label: string) => (
    <Grid item xs={6} sm={4} key={key}>
      <TextField
        fullWidth
        type="number"
        label={label}
        value={value[key] as number}
        onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<TournamentStructure>)}
        inputProps={{ min: 0 }}
      />
    </Grid>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Tournament Structure</Typography>
      <Grid container spacing={2}>
        {numberField('groupCount', 'Number of Groups')}
        {numberField('teamCount', 'Number of Teams')}
        {numberField('playersPerTeam', 'Players Per Team')}
        {numberField('benchPlayers', 'Bench Players')}
        {numberField('reservePlayers', 'Reserve Players')}
        {numberField('maxPlayers', 'Maximum Players')}
        {numberField('minPlayers', 'Minimum Players')}
        {numberField('maxTeams', 'Maximum Teams')}
        {numberField('minTeams', 'Minimum Teams')}
      </Grid>
      <Stack direction="row" spacing={3}>
        <FormControlLabel
          control={<Switch checked={value.captainRequired} onChange={(e) => onChange({ captainRequired: e.target.checked })} />}
          label="Captain Required"
        />
        <FormControlLabel
          control={<Switch checked={value.viceCaptainRequired} onChange={(e) => onChange({ viceCaptainRequired: e.target.checked })} />}
          label="Vice Captain"
        />
      </Stack>
      {value.teamCount % value.groupCount !== 0 && (
        <Typography variant="body2" color="warning.main">
          {value.teamCount} teams doesn't divide evenly across {value.groupCount} groups — groups will be uneven sizes.
        </Typography>
      )}
    </Stack>
  );
}
