import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Card, CardActionArea, CardContent, Container, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useNotifications } from '@/hooks/useNotifications';

function NotificationsContent() {
  const { tournament } = useTournament();
  const { notifications, loading, markSeen } = useNotifications();

  // Opening this page is what clears the unread badge.
  useEffect(() => { markSeen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !tournament) return <Typography color="text.secondary">Loading notifications…</Typography>;
  if (notifications.length === 0) return <Typography color="text.secondary">No notifications yet.</Typography>;

  return (
    <Stack spacing={1}>
      {notifications.map((n) => {
        const card = (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">{n.title}</Typography>
              <Typography variant="body2" color="text.secondary">{n.body}</Typography>
              <Typography variant="caption" color="text.secondary">{new Date(n.createdAt).toLocaleString()}</Typography>
            </CardContent>
          </Card>
        );
        return n.link ? (
          <CardActionArea key={n.id} component={RouterLink} to={n.link} sx={{ borderRadius: 1 }}>
            {card}
          </CardActionArea>
        ) : (
          <div key={n.id}>{card}</div>
        );
      })}
    </Stack>
  );
}

export default function Notifications() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Notifications</Typography>
      <VisibilityGate pageId="notifications">
        <NotificationsContent />
      </VisibilityGate>
    </Container>
  );
}
