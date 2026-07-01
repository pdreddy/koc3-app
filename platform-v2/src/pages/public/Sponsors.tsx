import { useEffect, useState } from 'react';
import { Avatar, Container, Grid, Link, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Sponsor } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

const TIER_ORDER: Sponsor['tier'][] = ['TITLE', 'GOLD', 'SILVER', 'BRONZE', 'PARTNER'];

function SponsorsContent() {
  const { repo, loading: tournamentLoading } = useTournament();
  const [items, setItems] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentLoading) return;
    repo<Sponsor>('sponsors').list().then((s) => {
      setItems(s.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;
  if (items.length === 0) return <Typography color="text.secondary">No sponsors listed yet.</Typography>;

  return (
    <Stack spacing={4}>
      {TIER_ORDER.filter((tier) => items.some((s) => s.tier === tier)).map((tier) => (
        <Stack key={tier} spacing={1.5}>
          <Typography variant="h6">{tier.charAt(0) + tier.slice(1).toLowerCase()} Sponsors</Typography>
          <Grid container spacing={2}>
            {items.filter((s) => s.tier === tier).map((s) => (
              <Grid item xs={6} sm={3} key={s.id}>
                <Stack spacing={1} alignItems="center">
                  {s.website ? (
                    <Link href={s.website} target="_blank" rel="noreferrer"><Avatar src={s.logoUrl} variant="rounded" sx={{ width: 72, height: 72 }} /></Link>
                  ) : (
                    <Avatar src={s.logoUrl} variant="rounded" sx={{ width: 72, height: 72 }} />
                  )}
                  <Typography variant="body2">{s.name}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}

export default function Sponsors() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Sponsors" subtitle="Thank you to everyone supporting this tournament." />
      <VisibilityGate pageId="sponsors">
        <SponsorsContent />
      </VisibilityGate>
    </Container>
  );
}
