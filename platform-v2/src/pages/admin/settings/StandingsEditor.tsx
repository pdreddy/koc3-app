import { IconButton, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { StandingsConfig } from '@/types';

const CRITERION_LABELS: Record<string, string> = {
  WINS: 'Wins', LOSSES: 'Losses', POINTS: 'Points', SETS_WON: 'Sets Won', SETS_LOST: 'Sets Lost',
  GAME_DIFF: 'Game Difference', GAMES_WON: 'Games Won', GAMES_LOST: 'Games Lost',
  HEAD_TO_HEAD: 'Head-to-Head', PERCENTAGE: 'Win Percentage', BONUS_POINTS: 'Bonus Points',
  PENALTY_POINTS: 'Penalty Points', CUSTOM_FORMULA: 'Custom Formula',
};

export default function StandingsEditor({ value, onChange }: { value: StandingsConfig; onChange: (patch: Partial<StandingsConfig>) => void }) {
  const move = (index: number, direction: -1 | 1) => {
    const next = [...value.tiebreakOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ tiebreakOrder: next });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Standings Configuration</Typography>
      <Stack direction="row" spacing={2}>
        <TextField type="number" label="Points Per Win" value={value.pointsPerWin} onChange={(e) => onChange({ pointsPerWin: Number(e.target.value) })} />
        <TextField type="number" label="Points Per Loss" value={value.pointsPerLoss} onChange={(e) => onChange({ pointsPerLoss: Number(e.target.value) })} />
      </Stack>
      <Typography variant="subtitle2">Tiebreak Priority Order (highest priority first)</Typography>
      <List dense sx={{ maxWidth: 400 }}>
        {value.tiebreakOrder.map((criterion, i) => (
          <ListItem
            key={criterion}
            secondaryAction={
              <Stack direction="row">
                <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={i === value.tiebreakOrder.length - 1} onClick={() => move(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
              </Stack>
            }
          >
            <ListItemText primary={`${i + 1}. ${CRITERION_LABELS[criterion] ?? criterion}`} />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
