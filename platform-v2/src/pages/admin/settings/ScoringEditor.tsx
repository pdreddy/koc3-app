import { FormControlLabel, Grid, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import type { AdRule, ScoringConfig, SetFormat, TiebreakFormat } from '@/types';

const SET_FORMATS: SetFormat[] = ['BEST_OF_3', 'BEST_OF_5', 'FAST_4', 'PRO_SET_8', 'PRO_SET_10', 'SIX_GAME_SET', 'FOUR_GAME_SET'];
const TIEBREAK_FORMATS: TiebreakFormat[] = ['TEN_POINT', 'CHAMPIONSHIP', 'GOLDEN_POINT', 'NONE'];

export default function ScoringEditor({ value, onChange }: { value: ScoringConfig; onChange: (patch: Partial<ScoringConfig>) => void }) {
  const numberField = (key: keyof ScoringConfig, label: string) => (
    <Grid item xs={6} sm={3} key={key}>
      <TextField fullWidth type="number" label={label} value={value[key] as number}
        onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<ScoringConfig>)} />
    </Grid>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Scoring Configuration</Typography>
      <Stack direction="row" spacing={2}>
        <Select value={value.setFormat} onChange={(e) => onChange({ setFormat: e.target.value as SetFormat })} sx={{ minWidth: 200 }}>
          {SET_FORMATS.map((f) => <MenuItem key={f} value={f}>{f.replaceAll('_', ' ')}</MenuItem>)}
        </Select>
        <Select value={value.tiebreakFormat} onChange={(e) => onChange({ tiebreakFormat: e.target.value as TiebreakFormat })} sx={{ minWidth: 200 }}>
          {TIEBREAK_FORMATS.map((f) => <MenuItem key={f} value={f}>{f.replaceAll('_', ' ')}</MenuItem>)}
        </Select>
        <Select value={value.adRule} onChange={(e) => onChange({ adRule: e.target.value as AdRule })} sx={{ minWidth: 160 }}>
          <MenuItem value="NO_AD">No-Ad</MenuItem>
          <MenuItem value="ADVANTAGE">Advantage</MenuItem>
        </Select>
      </Stack>
      <Grid container spacing={2}>
        {numberField('gamesPerSet', 'Games Per Set')}
        {numberField('setsToWin', 'Sets To Win')}
        {numberField('setTiebreakMinPoints', 'Set TB Min Points')}
        {numberField('setTiebreakWinBy', 'Set TB Win By')}
        {numberField('matchTiebreakMinPoints', 'Match TB Min Points')}
        {numberField('matchTiebreakWinBy', 'Match TB Win By')}
      </Grid>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {(['allowWalkover', 'allowRetired', 'allowIncomplete', 'allowRainSuspended', 'allowCancelled'] as const).map((key) => (
          <FormControlLabel key={key}
            control={<Switch checked={value[key]} onChange={(e) => onChange({ [key]: e.target.checked } as Partial<ScoringConfig>)} />}
            label={key.replace('allow', '').replace(/([A-Z])/g, ' $1').trim()}
          />
        ))}
      </Stack>
    </Stack>
  );
}
