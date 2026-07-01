import { Container, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { PageHeader } from '@/components/layout/PageHeader';

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
      <PageHeader title="Rules" subtitle="League format, eligibility, and scoring rules." />
      <VisibilityGate pageId="rules">
        <RulesContent />
      </VisibilityGate>
    </Container>
  );
}
