import { List, ListItemButton, ListItemText, Container, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

const LINKS = [
  { path: 'history', label: 'Match History' },
  { path: 'playoffs', label: 'Playoffs' },
  { path: 'matchups', label: 'Matchups & Player Stats' },
  { path: 'ratings', label: 'Player Ratings' },
  { path: 'rules', label: 'Rules' },
  { path: 'announcements', label: 'Announcements' },
  { path: 'sponsors', label: 'Sponsors' },
  { path: 'gallery', label: 'Gallery' },
];

function MoreContent() {
  const { tournament } = useTournament();
  if (!tournament) return null;
  const { info } = tournament.config;
  const basePath = `/t/${tournament.slug}`;

  return (
    <Stack spacing={2}>
      <GradientCard>
        <List sx={{ pt: 1.5 }}>
          {LINKS.map((link) => (
            <ListItemButton key={link.path} component={RouterLink} to={`${basePath}/${link.path}`}>
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>
      </GradientCard>
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">About</Typography>
          {info.organizer && <Typography variant="body2">Organizer: {info.organizer}</Typography>}
          {info.contactEmail && <Typography variant="body2">Contact: {info.contactEmail}</Typography>}
          {info.location && <Typography variant="body2">Location: {info.location}</Typography>}
          {info.website && <Typography variant="body2">Website: {info.website}</Typography>}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function More() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="More" subtitle="Additional pages and captain/admin login." />
      <VisibilityGate pageId="more">
        <MoreContent />
      </VisibilityGate>
    </Container>
  );
}
