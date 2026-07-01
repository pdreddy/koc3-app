import { useEffect, useState } from 'react';
import { Avatar, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Team } from '@/types';

function TeamsContent() {
  const { tournament, repo } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard on `tournament` itself, not just the loading flag — loading becomes false in
    // the error case too (e.g. tournament not found), when tournament is still null and
    // repo() would throw.
    if (!tournament) return;
    const unsubscribe = repo<Team>('teams').subscribeAll((items) => {
      setTeams(items);
      setLoading(false);
    });
    return unsubscribe;
  }, [tournament, repo]);

  if (loading) return <Typography color="text.secondary">Loading teams…</Typography>;
  if (teams.length === 0) return <Typography color="text.secondary">No teams yet.</Typography>;

  const byGroup = teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = t.group ?? 'Unassigned';
    (acc[key] ||= []).push(t);
    return acc;
  }, {});

  return (
    <Stack spacing={4}>
      {Object.entries(byGroup).map(([group, groupTeams]) => (
        <Stack key={group} spacing={1.5}>
          <Typography variant="h6">Group {group}</Typography>
          <Grid container spacing={2}>
            {groupTeams.map((team) => (
              <Grid item xs={12} sm={6} md={4} key={team.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar src={team.logoUrl ?? undefined}>{team.abbreviation?.slice(0, 2)}</Avatar>
                      <div>
                        <Typography variant="subtitle1">{team.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{team.playerIds.length} players</Typography>
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}

export default function PublicTeams() {
  return (
    <Container sx={{ py: 4 }}>
      <VisibilityGate pageId="teams">
        <TeamsContent />
      </VisibilityGate>
    </Container>
  );
}
