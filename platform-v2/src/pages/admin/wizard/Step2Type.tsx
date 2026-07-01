import { Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import type { TournamentType } from '@/types';

const TOURNAMENT_TYPES: { code: TournamentType; label: string; description: string }[] = [
  { code: 'KOC_LEAGUE', label: 'KOC League', description: 'Group stage + knockout playoffs, team-based (KOC\'s original format).' },
  { code: 'UTR_LEAGUE', label: 'UTR League', description: 'UTR-rated individual league play.' },
  { code: 'SINGLES_LEAGUE', label: 'Singles League', description: 'Individual singles matches only.' },
  { code: 'DOUBLES_LEAGUE', label: 'Doubles League', description: 'Doubles pairs only.' },
  { code: 'MIXED_LEAGUE', label: 'Mixed League', description: 'Mixed doubles format.' },
  { code: 'TEAM_LEAGUE', label: 'Team League', description: 'General team-vs-team league.' },
  { code: 'ROUND_ROBIN', label: 'Round Robin', description: 'Every entrant plays every other entrant once.' },
  { code: 'KNOCKOUT', label: 'Knockout', description: 'Single-elimination bracket.' },
  { code: 'DOUBLE_ELIMINATION', label: 'Double Elimination', description: 'Two losses before elimination.' },
  { code: 'SWISS', label: 'Swiss', description: 'Paired by similar record each round, no elimination.' },
  { code: 'LADDER', label: 'Ladder', description: 'Challenge-based ranking ladder.' },
  { code: 'CHALLENGE_COURT', label: 'Challenge Court', description: 'Open challenge court format.' },
  { code: 'GROUP_PLUS_KNOCKOUT', label: 'Group + Knockout', description: 'Group stage feeding into a knockout bracket.' },
  { code: 'CUSTOM', label: 'Custom', description: 'Start from a blank configuration.' },
];

export default function Step2Type({ value, onChange }: { value: TournamentType; onChange: (type: TournamentType) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Tournament Type</Typography>
      <Typography variant="body2" color="text.secondary">
        This sets sensible defaults for later steps — every value can still be changed individually.
      </Typography>
      <Grid container spacing={2}>
        {TOURNAMENT_TYPES.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.code}>
            <Card variant="outlined" sx={{ borderColor: value === t.code ? 'primary.main' : undefined, borderWidth: value === t.code ? 2 : 1 }}>
              <CardActionArea onClick={() => onChange(t.code)} data-testid={`tournament-type-${t.code}`}>
                <CardContent>
                  <Typography variant="subtitle1">{t.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{t.description}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
