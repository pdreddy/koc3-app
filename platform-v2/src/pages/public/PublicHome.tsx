import { Chip, Container, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';

function formatDate(ms: number | null): string {
  if (!ms) return 'TBD';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HomeContent() {
  const { tournament } = useTournament();
  if (!tournament) return null;
  const { info, structure } = tournament.config;

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{info.name}</Typography>
        {info.description && <Typography color="text.secondary">{info.description}</Typography>}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${structure.teamCount} teams`} />
          <Chip label={`${structure.groupCount} groups`} />
          <Chip label={`${formatDate(info.startsAt)} – ${formatDate(info.endsAt)}`} />
          {info.location && <Chip label={info.location} />}
        </Stack>
      </Stack>
    </Container>
  );
}

export default function PublicHome() {
  return (
    <VisibilityGate pageId="home">
      <HomeContent />
    </VisibilityGate>
  );
}
