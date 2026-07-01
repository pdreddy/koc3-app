import { FormControlLabel, Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import type { MatchLineupSlot, MatchTypeConfig } from '@/types';

export default function MatchTypesEditor({
  matchTypes, lineup, onMatchTypesChange, onLineupChange,
}: {
  matchTypes: MatchTypeConfig[];
  lineup: MatchLineupSlot[];
  onMatchTypesChange: (next: MatchTypeConfig[]) => void;
  onLineupChange: (next: MatchLineupSlot[]) => void;
}) {
  const toggleType = (code: string, enabled: boolean) => {
    onMatchTypesChange(matchTypes.map((t) => (t.code === code ? { ...t, enabled } : t)));
  };

  const setLineupCount = (matchType: string, count: number) => {
    const existing = lineup.find((l) => l.matchType === matchType);
    if (existing) {
      onLineupChange(count > 0 ? lineup.map((l) => (l.matchType === matchType ? { ...l, count } : l)) : lineup.filter((l) => l.matchType !== matchType));
    } else if (count > 0) {
      onLineupChange([...lineup, { matchType: matchType as MatchLineupSlot['matchType'], count }]);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Match Types</Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
        {matchTypes.map((t) => (
          <FormControlLabel key={t.code}
            control={<Switch checked={t.enabled} onChange={(e) => toggleType(t.code, e.target.checked)} />}
            label={t.label}
          />
        ))}
      </Stack>

      <Typography variant="h6">Match Day Lineup</Typography>
      <Typography variant="body2" color="text.secondary">
        How many lines of each enabled match type make up one match day (e.g. 1 Singles + 2 Doubles).
      </Typography>
      <Grid container spacing={2}>
        {matchTypes.filter((t) => t.enabled).map((t) => (
          <Grid item xs={6} sm={3} key={t.code}>
            <TextField
              fullWidth type="number" label={t.label}
              value={lineup.find((l) => l.matchType === t.code)?.count ?? 0}
              onChange={(e) => setLineupCount(t.code, Number(e.target.value))}
              inputProps={{ min: 0 }}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
