import { FormControlLabel, Grid, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import type { PlayerConfig, VisibilityLevel, VisibilityMap } from '@/types';
import { DEFAULT_VISIBILITY } from '@/types';

export function PlayerConfigEditor({ value, onChange }: { value: PlayerConfig; onChange: (patch: Partial<PlayerConfig>) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Player Configuration</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth type="number" label="Min Age" value={value.minAge ?? ''} onChange={(e) => onChange({ minAge: e.target.value ? Number(e.target.value) : null })} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth type="number" label="Max Age" value={value.maxAge ?? ''} onChange={(e) => onChange({ maxAge: e.target.value ? Number(e.target.value) : null })} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Select fullWidth value={value.genderRule} onChange={(e) => onChange({ genderRule: e.target.value as PlayerConfig['genderRule'] })}>
            <MenuItem value="ANY">Any</MenuItem>
            <MenuItem value="MEN">Men</MenuItem>
            <MenuItem value="WOMEN">Women</MenuItem>
            <MenuItem value="MIXED">Mixed</MenuItem>
          </Select>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth type="number" label="Registration Fee" value={value.registrationFee} onChange={(e) => onChange({ registrationFee: Number(e.target.value) })} />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {(['utrRequired', 'ntrpRequired', 'skillRatingRequired', 'membershipRequired', 'approvalRequired', 'waitlistEnabled'] as const).map((key) => (
          <FormControlLabel key={key}
            control={<Switch checked={value[key]} onChange={(e) => onChange({ [key]: e.target.checked } as Partial<PlayerConfig>)} />}
            label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()}
          />
        ))}
      </Stack>
    </Stack>
  );
}

const PAGE_LABELS: Record<string, string> = {
  home: 'Home', schedule: 'Schedule', standings: 'Standings', teams: 'Teams', gallery: 'Gallery',
  rules: 'Rules', announcements: 'Announcements', sponsors: 'Sponsors', history: 'History',
  playoffs: 'Playoffs', notifications: 'Notifications', matchups: 'Matchups', ratings: 'Player Ratings',
  more: 'More', playerProfiles: 'Player Profiles',
  captainDashboard: 'Captain Dashboard', scoreEntry: 'Score Entry', lineupSubmission: 'Lineup Submission',
  adminDashboard: 'Admin Dashboard', playerImport: 'Player Import', tournamentSettings: 'Tournament Settings',
  auditLogs: 'Audit Logs',
};

const VISIBILITY_OPTIONS: VisibilityLevel[] = ['PUBLIC', 'LOGIN_REQUIRED', 'REGISTERED_PLAYER', 'CAPTAIN', 'ADMIN', 'HIDDEN'];

export function VisibilityEditor({ value, onChange }: { value: VisibilityMap; onChange: (next: VisibilityMap) => void }) {
  // Merge in any default page ids missing from this tournament's saved config (e.g. it was
  // created before a page existed) so the admin can see and configure every current page,
  // not just the ones that existed at creation time.
  const merged = { ...DEFAULT_VISIBILITY, ...value };
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Screen Visibility</Typography>
      <Grid container spacing={2}>
        {Object.entries(merged).map(([pageId, level]) => (
          <Grid item xs={12} sm={6} key={pageId}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ flexGrow: 1 }}>{PAGE_LABELS[pageId] ?? pageId}</Typography>
              <Select size="small" value={level} onChange={(e) => onChange({ ...merged, [pageId]: e.target.value as VisibilityLevel })} sx={{ minWidth: 180 }}>
                {VISIBILITY_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt.replaceAll('_', ' ')}</MenuItem>)}
              </Select>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
