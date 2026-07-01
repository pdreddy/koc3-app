import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Container, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { Player, Team } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { GradientCard } from '@/components/layout/GradientCard';
import { ImageUploadField } from '@/components/ImageUploadField';

// Team generation (GenerateTeams.tsx) only ever produces "Team 1", "Team 2", ... with no
// captain assigned — there was no way to fix that afterward (rename, set a logo, or
// designate who's actually captain) until this page. Every field here is a plain,
// debounced-on-blur Firestore update; no separate "save" step per team.
function TeamEditor({ team, players, onSaved }: { team: Team; players: Record<string, Player>; onSaved: (patch: Partial<Team>) => void }) {
  const { tournament, repo } = useTournament();
  const [name, setName] = useState(team.name);
  const [abbreviation, setAbbreviation] = useState(team.abbreviation);

  useEffect(() => { setName(team.name); setAbbreviation(team.abbreviation); }, [team.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tournament) return null;
  const teamRepo = repo<Team>('teams');
  const playerRepo = repo<Player>('players');

  const saveName = async () => {
    if (name === team.name) return;
    await teamRepo.update(team.id, { name });
    onSaved({ name });
  };
  const saveAbbreviation = async () => {
    if (abbreviation === team.abbreviation) return;
    await teamRepo.update(team.id, { abbreviation });
    onSaved({ abbreviation });
  };
  const saveLogo = async (logoUrl: string) => {
    await teamRepo.update(team.id, { logoUrl: logoUrl || null });
    onSaved({ logoUrl: logoUrl || null });
  };

  const handleCaptainChange = async (playerId: string) => {
    const newCaptainId = playerId || null;
    if (team.captainPlayerId) await playerRepo.update(team.captainPlayerId, { isCaptain: false });
    if (newCaptainId) await playerRepo.update(newCaptainId, { isCaptain: true });
    await teamRepo.update(team.id, { captainPlayerId: newCaptainId });
    onSaved({ captainPlayerId: newCaptainId });
  };

  const handleViceCaptainChange = async (playerId: string) => {
    const newViceId = playerId || null;
    if (team.viceCaptainPlayerId) await playerRepo.update(team.viceCaptainPlayerId, { isViceCaptain: false });
    if (newViceId) await playerRepo.update(newViceId, { isViceCaptain: true });
    await teamRepo.update(team.id, { viceCaptainPlayerId: newViceId });
    onSaved({ viceCaptainPlayerId: newViceId });
  };

  return (
    <GradientCard>
      <Stack spacing={2} sx={{ p: 2.5, pt: 3 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField label="Team Name" size="small" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} sx={{ minWidth: 200 }} />
          <TextField label="Abbreviation" size="small" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} onBlur={saveAbbreviation} sx={{ width: 120 }} />
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>Group {team.group ?? '—'}</Typography>
        </Stack>
        <ImageUploadField label="Logo URL" value={team.logoUrl ?? ''} onChange={saveLogo} tournamentId={tournament.id} storagePath={`teams/${team.id}/logo`} />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">Captain</Typography>
            <Select size="small" value={team.captainPlayerId ?? ''} displayEmpty onChange={(e) => handleCaptainChange(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">— None —</MenuItem>
              {team.playerIds.map((pid) => <MenuItem key={pid} value={pid}>{players[pid]?.displayName ?? pid}</MenuItem>)}
            </Select>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">Vice Captain</Typography>
            <Select size="small" value={team.viceCaptainPlayerId ?? ''} displayEmpty onChange={(e) => handleViceCaptainChange(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">— None —</MenuItem>
              {team.playerIds.map((pid) => <MenuItem key={pid} value={pid}>{players[pid]?.displayName ?? pid}</MenuItem>)}
            </Select>
          </Stack>
        </Stack>
      </Stack>
    </GradientCard>
  );
}

function ManageTeamsContent() {
  const { tournament, repo } = useTournament();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([repo<Team>('teams').list(), repo<Player>('players').list()]).then(([t, p]) => {
      setTeams(t.sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0)));
      setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
      setLoading(false);
    });
  }, [tournament, repo]);

  if (!tournament) return null;
  if (loading) return <Typography color="text.secondary">Loading teams…</Typography>;
  if (teams.length === 0) return <Alert severity="warning">No teams yet — generate teams first.</Alert>;

  const updateTeamLocal = (id: string, patch: Partial<Team>) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  return (
    <Stack spacing={2}>
      {teams.map((team) => (
        <TeamEditor key={team.id} team={team} players={players} onSaved={(patch) => updateTeamLocal(team.id, patch)} />
      ))}
    </Stack>
  );
}

export default function ManageTeams() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageHeader title="Manage Teams" subtitle="Rename teams, set logos, and assign captains." />
      <TournamentProvider tournamentId={tournamentId}>
        <ManageTeamsContent />
      </TournamentProvider>
    </Container>
  );
}
