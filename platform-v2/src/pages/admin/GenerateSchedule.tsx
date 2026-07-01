import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { TournamentProvider, useTournament } from '@/contexts/TournamentContext';
import type { ScheduleEntry, Team } from '@/types';
import { generateSchedule } from '@/services/scheduleGenerator';

function GenerateScheduleContent() {
  const { repo } = useTournament();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('7:00 PM');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    repo<Team>('teams').list().then((t) => { setTeams(t); setLoading(false); });
  }, [repo]);

  const byGroup = teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = t.group ?? 'A';
    (acc[key] ||= []).push(t);
    return acc;
  }, {});
  const groupsWithOddTeams = Object.entries(byGroup).filter(([, g]) => g.length % 2 !== 0).map(([g]) => g);

  const handleGenerate = async () => {
    setGenerating(true);
    const entries = generateSchedule(
      Object.entries(byGroup).map(([group, groupTeams]) => ({
        group,
        teams: groupTeams,
        firstDate: new Date(`${startDate}T00:00:00`),
        time,
      })),
      Date.now()
    );
    const scheduleRepo = repo<ScheduleEntry>('schedules');
    await Promise.all(entries.map((e) => scheduleRepo.create(e)));
    setGenerating(false);
    setResult(`Generated ${entries.length} scheduled matches across ${Object.keys(byGroup).length} groups.`);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Generate Schedule</Typography>
      {loading ? (
        <Typography color="text.secondary">Loading teams…</Typography>
      ) : teams.length === 0 ? (
        <Alert severity="warning">
          No teams found — generate teams first.
          <Button size="small" sx={{ ml: 1 }} onClick={() => navigate(`/admin/tournaments/${tournamentId}/generate-teams`)}>
            Generate Teams
          </Button>
        </Alert>
      ) : (
        <>
          <Typography>{teams.length} teams across {Object.keys(byGroup).length} groups.</Typography>
          {groupsWithOddTeams.length > 0 && (
            <Alert severity="info">
              Group{groupsWithOddTeams.length > 1 ? 's' : ''} {groupsWithOddTeams.join(', ')} {groupsWithOddTeams.length > 1 ? 'have' : 'has'} an odd number of teams — one bye per round in that group.
            </Alert>
          )}
          <TextField type="date" label="First Round Date" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} sx={{ maxWidth: 240 }} />
          <TextField label="Match Time" value={time} onChange={(e) => setTime(e.target.value)} sx={{ maxWidth: 240 }} />
          {result && <Alert severity="success">{result}</Alert>}
          <Stack direction="row" spacing={2}>
            <Button variant="contained" disabled={generating} onClick={handleGenerate}>
              {generating ? 'Generating…' : 'Generate Schedule'}
            </Button>
            {result && (
              <Button onClick={() => navigate(`/admin/tournaments/${tournamentId}`)}>Back to Tournament</Button>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default function GenerateSchedule() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  if (!tournamentId) return <Alert severity="error">Missing tournament id</Alert>;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <TournamentProvider tournamentId={tournamentId}>
        <GenerateScheduleContent />
      </TournamentProvider>
    </Container>
  );
}
