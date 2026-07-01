import { Container, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';

function RulesContent() {
  const { tournament } = useTournament();
  if (!tournament) return null;
  const { rulesText } = tournament.config.info;
  if (!rulesText.trim()) return <Typography color="text.secondary">No rules have been published for this tournament yet.</Typography>;
  return <Typography sx={{ whiteSpace: 'pre-wrap' }}>{rulesText}</Typography>;
}

export default function PublicRules() {
  return (
    <Container sx={{ py: 4 }}>
      <VisibilityGate pageId="rules">
        <RulesContent />
      </VisibilityGate>
    </Container>
  );
}
