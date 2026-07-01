import { FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import type { EligibilityConfig } from '@/types';

function CapField({
  label, value, onChange,
}: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <TextField
      label={label} type="number" size="small" sx={{ maxWidth: 200 }}
      value={value ?? ''}
      placeholder="No limit"
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

export default function EligibilityEditor({ value, onChange }: { value: EligibilityConfig; onChange: (patch: Partial<EligibilityConfig>) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Player Eligibility &amp; Capacity Caps</Typography>
      <Typography variant="body2" color="text.secondary">
        Caps how many "match days" (scheduled fixtures) a player can be used for across the
        season — captains see live warnings while building a lineup once these are set.
        Leave a field blank for no limit.
      </Typography>
      <FormControlLabel
        control={<Switch checked={value.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />}
        label="Enforce eligibility caps"
      />
      {value.enabled && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <CapField label="Max Singles Days / Player" value={value.maxSinglesDaysPerPlayer} onChange={(v) => onChange({ maxSinglesDaysPerPlayer: v })} />
            <CapField label="Max Total Match Days / Player" value={value.maxTotalMatchDaysPerPlayer} onChange={(v) => onChange({ maxTotalMatchDaysPerPlayer: v })} />
            <CapField label="Max Days / Doubles Partner Pair" value={value.maxPartnerDaysPerPair} onChange={(v) => onChange({ maxPartnerDaysPerPair: v })} />
          </Stack>
          <FormControlLabel
            control={<Switch checked={value.allowSinglesAndDoublesSameDay} onChange={(e) => onChange({ allowSinglesAndDoublesSameDay: e.target.checked })} />}
            label="Allow a player to play both singles and doubles on the same match day"
          />
        </Stack>
      )}
    </Stack>
  );
}
