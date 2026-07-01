import { useEffect, useState } from 'react';
import { CardContent, Container, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Announcement } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

function AnnouncementsContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    repo<Announcement>('announcements').list().then((a) => {
      setItems(a.sort((x, y) => y.publishedAt - x.publishedAt));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;
  if (items.length === 0) return <Typography color="text.secondary">No announcements yet.</Typography>;

  return (
    <Stack spacing={2}>
      {items.map((a) => (
        <GradientCard key={a.id}>
          <CardContent>
            <Typography variant="h6">{a.title}</Typography>
            <Typography variant="body2" color="text.secondary">{new Date(a.publishedAt).toLocaleDateString()}</Typography>
            <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{a.body}</Typography>
          </CardContent>
        </GradientCard>
      ))}
    </Stack>
  );
}

export default function Announcements() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Announcements" subtitle="Updates from the tournament organizers." />
      <VisibilityGate pageId="announcements">
        <AnnouncementsContent />
      </VisibilityGate>
    </Container>
  );
}
