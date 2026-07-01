import { List, ListItemButton, ListItemText, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

const PUBLIC_LINKS = [
  { path: 'history', label: 'Match History' },
  { path: 'playoffs', label: 'Playoffs' },
  { path: 'matchups', label: 'Matchups & Player Stats' },
  { path: 'ratings', label: 'Player Ratings' },
  { path: 'rules', label: 'Rules' },
  { path: 'announcements', label: 'Announcements' },
  { path: 'sponsors', label: 'Sponsors' },
  { path: 'gallery', label: 'Gallery' },
];

// koc3-app's More.js differentiates sections by role (captain shortcuts, admin shortcuts,
// public shortcuts) rather than showing everyone the same flat list — this mirrors that.
function LinkList({ title, links, basePath }: { title: string; links: { path: string; label: string }[]; basePath: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      <GradientCard>
        <List sx={{ pt: 1.5 }}>
          {links.map((link) => (
            <ListItemButton key={link.path} component={RouterLink} to={`${basePath}/${link.path}`}>
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>
      </GradientCard>
    </Stack>
  );
}

function MoreContent() {
  const { tournament } = useTournament();
  const { user, signOut } = useAuth();
  const { role } = useTournamentRole();
  if (!tournament) return null;
  const { info } = tournament.config;
  const basePath = `/t/${tournament.slug}`;

  const isAdmin = role === 'TOURNAMENT_ADMIN' || role === 'ORGANIZER';
  const isCaptain = role === 'CAPTAIN' || role === 'VICE_CAPTAIN';

  return (
    <Stack spacing={2}>
      {isAdmin && (
        <LinkList
          title="Admin"
          basePath="/admin/tournaments"
          links={[
            { path: tournament.id, label: 'Admin Dashboard' },
            { path: `${tournament.id}/manage-teams`, label: 'Manage Teams' },
            { path: `${tournament.id}/approve-scores`, label: 'Approve Scores' },
            { path: `${tournament.id}/roles`, label: 'Team Roles' },
            { path: `${tournament.id}/analytics`, label: 'Analytics' },
          ]}
        />
      )}
      {isCaptain && (
        <LinkList
          title="Captain"
          basePath={basePath}
          links={[{ path: '', label: 'My Dashboard' }, { path: 'lineup', label: 'Submit Lineup' }, { path: 'score', label: 'Enter Score' }]}
        />
      )}

      <LinkList title="Public" links={PUBLIC_LINKS} basePath={basePath} />

      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">About</Typography>
          {info.organizer && <Typography variant="body2">Organizer: {info.organizer}</Typography>}
          {info.contactEmail && <Typography variant="body2">Contact: {info.contactEmail}</Typography>}
          {info.location && <Typography variant="body2">Location: {info.location}</Typography>}
          {info.website && <Typography variant="body2">Website: {info.website}</Typography>}
        </Stack>
      </Paper>

      {user && (
        <Button variant="outlined" color="error" onClick={() => signOut()} sx={{ alignSelf: 'flex-start' }}>
          Sign Out
        </Button>
      )}
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
