import { List, ListItemButton, ListItemText, Container, Stack, Typography, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';

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
      <List>
        {LINKS.map((link) => (
          <ListItemButton key={link.path} component={RouterLink} to={`${basePath}/${link.path}`}>
            <ListItemText primary={link.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">About</Typography>
        {info.organizer && <Typography variant="body2">Organizer: {info.organizer}</Typography>}
        {info.contactEmail && <Typography variant="body2">Contact: {info.contactEmail}</Typography>}
        {info.location && <Typography variant="body2">Location: {info.location}</Typography>}
        {info.website && <Typography variant="body2">Website: {info.website}</Typography>}
      </Stack>
    </Stack>
  );
}

export default function More() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>More</Typography>
      <VisibilityGate pageId="more">
        <MoreContent />
      </VisibilityGate>
    </Container>
  );
}
