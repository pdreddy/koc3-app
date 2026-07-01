import { useEffect, useState } from 'react';
import { Container, ImageList, ImageListItem, ImageListItemBar, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { GalleryImage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

function GalleryContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    repo<GalleryImage>('gallery').list().then((g) => {
      setItems(g.sort((a, b) => b.uploadedAt - a.uploadedAt));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;
  if (items.length === 0) return <Typography color="text.secondary">No photos yet.</Typography>;

  return (
    <ImageList cols={3} gap={8}>
      {items.map((g) => (
        <ImageListItem key={g.id}>
          <img src={g.url} alt={g.caption ?? ''} loading="lazy" />
          {g.caption && <ImageListItemBar title={g.caption} />}
        </ImageListItem>
      ))}
    </ImageList>
  );
}

export default function Gallery() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Gallery" subtitle="Photos from the tournament." />
      <VisibilityGate pageId="gallery">
        <GalleryContent />
      </VisibilityGate>
    </Container>
  );
}
