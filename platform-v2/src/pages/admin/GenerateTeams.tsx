import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Button, Container, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { Player, Team } from '@/types';
import { generateTeams, type TeamGenerationMethod } from '@/services/teamGenerator';

function GenerateTeamsContent() {
  const { tournament, repo } = useTournament();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(tournament?.config.structure.teamCount ?? 16);
  const [method, setMethod] = useState<TeamGenerationMethod>('BALANCED_SNAKE_DRAFT');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    repo<Player>('players').list().then((p) => {
      setPlayers(p.filter((player) => !player.teamId));
      setLoading(false);
    });
  }, [repo]);

  useEffect(() => {
    if (tournament) setTeamCount(tournament.config.structure.teamCount);
  }, [tournament]);

  if (!tournament) return null;
  const groupCount = tournament.config.structure.groupCount;
  // Require at least one player per team; teams can be topped up to full rosters later.
  const canGenerate = teamCount > 0 && players.length >= teamCount;

  const handleGenerate = async () => {
    setGenerating(true);
    const generated = generateTeams(players, teamCount, groupCount, method);
    const teamRepo = repo<Team>('teams');
    const playerRepo = repo<Player>('players');
    const now = Date.now();

    const createdTeams = await Promise.all(generated.map((g, idx) =>
      teamRepo.create({
        name: `Team ${idx + 1}`,
        abbreviation: `T${idx + 1}`,
        group: g.group,
        groupOrder: idx,
        logoUrl: null,
        captainPlayerId: null,
        viceCaptainPlayerId: null,
        playerIds: g.playerIds,
        password: null,
        createdAt: now,
        updatedAt: now,
      })
    ));

    await Promise.all(
      generated.flatMap((g, idx) =>
        g.playerIds.map((playerId) => playerRepo.update(playerId, { teamId: createdTeams[idx].id }))
      )
    );

    setGenerating(false);
    setResult(`Created ${createdTeams.length} teams across ${groupCount} groups from ${players.length} players.`);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Generate Teams</Typography>
      {loading ? (
        <Typography color="text.secondary">Loading players…</Typography>
      ) : (
        <>
          <Typography>{players.length} unassigned players available.</Typography>
          {players.length === 0 && (
            <Alert severity="warning">
              No unassigned players found — import a roster first.
              <Button size="small" sx={{ ml: 1 }} onClick={() => navigate(`/admin/tournaments/${tournamentId}/import-players`)}>
                Import Players
              </Button>
            </Alert>
          )}
          <TextField
            label="Number of Teams" type="number" value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
            sx={{ maxWidth: 240 }}
          />
          <Select value={method} onChange={(e) => setMethod(e.target.value as TeamGenerationMethod)} sx={{ maxWidth: 320 }}>
            <MenuItem value="RANDOM">Random</MenuItem>
            <MenuItem value="BALANCED_SNAKE_DRAFT">Balanced (snake draft by UTR)</MenuItem>
          </Select>
          {!canGenerate && <Alert severity="warning">Not enough unassigned players for {teamCount} teams.</Alert>}
          {result && <Alert severity="success">{result}</Alert>}
          <Stack direction="row" spacing={2}>
            <Button variant="contained" disabled={!canGenerate || generating} onClick={handleGenerate}>
              {generating ? 'Generating…' : 'Generate Teams'}
            </Button>
            {result && (
              <Button onClick={() => navigate(`/admin/tournaments/${tournamentId}/generate-schedule`)}>
                Continue to Generate Schedule →
              </Button>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default function GenerateTeams() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <GenerateTeamsContent />
      </TournamentProvider>
    </Container>
  );
}
