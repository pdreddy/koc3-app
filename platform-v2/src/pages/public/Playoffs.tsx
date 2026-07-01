import { useEffect, useState } from 'react';
import { Container, Stack, Typography } from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { PlayoffMatch, PlayoffRoundType, Team } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';

const ROUND_LABELS: Record<PlayoffRoundType, string> = {
  QUARTERFINAL: 'Quarterfinal',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
  THIRD_PLACE: 'Third Place',
};

const ROUND_DISPLAY_ORDER: PlayoffRoundType[] = ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

function TeamLine({ name, seed, isWinner, isBye }: { name: string; seed: number | null; isWinner: boolean; isBye: boolean }) {
  return (
    <Typography
      variant="body2"
      sx={{ fontWeight: isWinner ? 700 : 400, color: isBye ? 'text.disabled' : 'text.primary' }}
    >
      {seed != null && <Typography component="span" variant="caption" color="text.secondary">#{seed}{' '}</Typography>}
      {name}
    </Typography>
  );
}

function BracketMatchCard({ match, teams }: { match: PlayoffMatch; teams: Record<string, Team> }) {
  const team1Name = match.team1Id ? teams[match.team1Id]?.name ?? match.team1Id : 'TBD';
  const team2Name = match.team2Id ? teams[match.team2Id]?.name ?? match.team2Id : 'TBD';
  return (
    <GradientCard sx={{ p: 1.5, minWidth: 200 }}>
      <TeamLine name={team1Name} seed={match.team1Seed} isWinner={match.winnerTeamId === match.team1Id} isBye={!match.team1Id} />
      <TeamLine name={team2Name} seed={match.team2Seed} isWinner={match.winnerTeamId === match.team2Id} isBye={!match.team2Id} />
    </GradientCard>
  );
}

function PlayoffsContent() {
  const { tournament, repo } = useTournament();
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([repo<PlayoffMatch>('playoffMatches').list(), repo<Team>('teams').list()]).then(([m, t]) => {
      setMatches(m);
      setTeams(Object.fromEntries(t.map((tm) => [tm.id, tm])));
      setLoading(false);
    });
  }, [tournament, repo]);

  if (loading || !tournament) return <Typography color="text.secondary">Loading bracket…</Typography>;
  if (matches.length === 0) return <Typography color="text.secondary">The playoff bracket hasn't been generated yet.</Typography>;

  const roundsPresent = ROUND_DISPLAY_ORDER.filter((r) => matches.some((m) => m.round === r));
  const thirdPlace = matches.find((m) => m.round === 'THIRD_PLACE');

  return (
    <Stack spacing={4}>
      <Stack direction="row" spacing={4} sx={{ overflowX: 'auto', pb: 2 }}>
        {roundsPresent.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
          return (
            <Stack key={round} spacing={2} sx={{ minWidth: 220 }}>
              <Typography variant="subtitle1">{ROUND_LABELS[round]}</Typography>
              <Stack spacing={4} sx={{ justifyContent: 'space-around', flexGrow: 1 }}>
                {roundMatches.map((m) => <BracketMatchCard key={m.id} match={m} teams={teams} />)}
              </Stack>
            </Stack>
          );
        })}
      </Stack>
      {thirdPlace && (
        <Stack spacing={2} sx={{ maxWidth: 220 }}>
          <Typography variant="subtitle1">Third Place</Typography>
          <BracketMatchCard match={thirdPlace} teams={teams} />
        </Stack>
      )}
    </Stack>
  );
}

export default function Playoffs() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Playoffs" subtitle="Knockout bracket seeded from group standings." />
      <VisibilityGate pageId="playoffs">
        <PlayoffsContent />
      </VisibilityGate>
    </Container>
  );
}
