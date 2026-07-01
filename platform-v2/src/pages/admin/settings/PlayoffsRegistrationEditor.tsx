import { FormControlLabel, Grid, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import type { ApprovalMode, PlayoffConfig, PlayoffQualifyCount, RegistrationConfig, RegistrationMode, SeedingMethod } from '@/types';

export function PlayoffsEditor({ value, onChange }: { value: PlayoffConfig; onChange: (patch: Partial<PlayoffConfig>) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Playoff Configuration</Typography>
      <FormControlLabel control={<Switch checked={value.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />} label="Playoffs Enabled" />
      {value.enabled && (
        <>
          <Stack direction="row" spacing={2}>
            <Select value={value.qualifyPerGroup} onChange={(e) => onChange({ qualifyPerGroup: Number(e.target.value) as PlayoffQualifyCount })} sx={{ minWidth: 160 }}>
              {[2, 4, 8, 16].map((n) => <MenuItem key={n} value={n}>Top {n} qualify</MenuItem>)}
            </Select>
            <Select value={value.seedingMethod} onChange={(e) => onChange({ seedingMethod: e.target.value as SeedingMethod })} sx={{ minWidth: 160 }}>
              <MenuItem value="AUTOMATIC">Automatic Seeding</MenuItem>
              <MenuItem value="MANUAL">Manual Seeding</MenuItem>
              <MenuItem value="RANDOM">Random Seeding</MenuItem>
            </Select>
          </Stack>
          <Grid container spacing={1}>
            {(['hasQuarterFinal', 'hasSemiFinal', 'hasFinal', 'hasThirdPlaceMatch', 'hasConsolationDraw', 'hasBronzeMatch'] as const).map((key) => (
              <Grid item xs={6} sm={4} key={key}>
                <FormControlLabel
                  control={<Switch checked={value[key]} onChange={(e) => onChange({ [key]: e.target.checked } as Partial<PlayoffConfig>)} />}
                  label={key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Stack>
  );
}

export function RegistrationEditor({ value, onChange }: { value: RegistrationConfig; onChange: (patch: Partial<RegistrationConfig>) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Registration Configuration</Typography>
      <Stack direction="row" spacing={2}>
        <Select value={value.mode} onChange={(e) => onChange({ mode: e.target.value as RegistrationMode })} sx={{ minWidth: 180 }}>
          <MenuItem value="PUBLIC">Public Registration</MenuItem>
          <MenuItem value="INVITE_ONLY">Invite Only</MenuItem>
        </Select>
        <Select value={value.approvalMode} onChange={(e) => onChange({ approvalMode: e.target.value as ApprovalMode })} sx={{ minWidth: 200 }}>
          <MenuItem value="NONE">No Approval</MenuItem>
          <MenuItem value="ADMIN_APPROVAL">Admin Approval</MenuItem>
          <MenuItem value="CAPTAIN_APPROVAL">Captain Approval</MenuItem>
        </Select>
      </Stack>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <FormControlLabel control={<Switch checked={value.paid} onChange={(e) => onChange({ paid: e.target.checked })} />} label="Paid Registration" />
        <FormControlLabel control={<Switch checked={value.waitlistEnabled} onChange={(e) => onChange({ waitlistEnabled: e.target.checked })} />} label="Waitlist" />
        <FormControlLabel control={<Switch checked={value.replacementPlayersAllowed} onChange={(e) => onChange({ replacementPlayersAllowed: e.target.checked })} />} label="Replacement Players" />
        <FormControlLabel control={<Switch checked={value.closesAutomaticallyAtCapacity} onChange={(e) => onChange({ closesAutomaticallyAtCapacity: e.target.checked })} />} label="Auto-close at Capacity" />
      </Stack>
    </Stack>
  );
}
