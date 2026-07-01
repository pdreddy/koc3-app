import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Container, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import type { LineupSubmission, Player, ScheduleEntry, Team } from '@/types';
import { lineupDocId } from '@/types';
import { buildLineSpecs } from '@/services/matchLines';
import { writeAuditLog } from '@/services/auditService';
import { PageHeader } from '@/components/layout/PageHeader';

function LineupContent() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const { teamId } = useTournamentRole();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [roster, setRoster] = useState<Player[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [ownLineup, setOwnLineup] = useState<LineupSubmission | null>(null);
  const [opponentLineup, setOpponentLineup] = useState<LineupSubmission | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament || !teamId) return;
    Promise.all([repo<ScheduleEntry>('schedules').list(), repo<Team>('teams').list()]).then(([schedules, teamList]) => {
      setEntries(schedules.filter((e) => e.status === 'SCHEDULED' && (e.team1Id === teamId || e.team2Id === teamId)));
      setTeams(Object.fromEntries(teamList.map((t) => [t.id, t])));
    });
  }, [tournament, repo, teamId]);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null;
  const opponentTeamId = selectedEntry ? (selectedEntry.team1Id === teamId ? selectedEntry.team2Id : selectedEntry.team1Id) : null;

  useEffect(() => {
    if (!teamId) return;
    const team = teams[teamId];
    if (!team) return;
    Promise.all(team.playerIds.map((id) => repo<Player>('players').get(id))).then((players) => {
      setRoster(players.filter((p): p is Player => Boolean(p)));
    });
  }, [teamId, teams, repo]);

  useEffect(() => {
    if (!selectedEntry || !teamId) {
      setOwnLineup(null);
      setOpponentLineup(null);
      return;
    }
    const lineupRepo = repo<LineupSubmission>('lineups');
    lineupRepo.get(lineupDocId(selectedEntry.id, teamId)).then((own) => {
      setOwnLineup(own);
      if (own) setSelections(Object.fromEntries(own.lines.map((l) => [l.label, l.playerIds])));
    });
    if (opponentTeamId) {
      lineupRepo
        .get(lineupDocId(selectedEntry.id, opponentTeamId))
        .then(setOpponentLineup)
        .catch(() => setOpponentLineup(null)); // denied until both locked — expected, not an error
    }
  }, [selectedEntry, teamId, opponentTeamId, repo]);

  const lineSpecs = useMemo(() => (tournament ? buildLineSpecs(tournament.config) : []), [tournament]);
  const revealed = Boolean(ownLineup?.lockedAt && opponentLineup?.lockedAt);

  const handleSave = async (lock: boolean) => {
    if (!selectedEntry || !teamId || !user) return;
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const lines = lineSpecs.map((spec) => ({
        label: spec.label,
        matchType: spec.matchType,
        playerIds: selections[spec.label] ?? [],
      }));
      const saved = await repo<LineupSubmission>('lineups').setWithId(lineupDocId(selectedEntry.id, teamId), {
        scheduleEntryId: selectedEntry.id,
        teamId,
        tournamentId: tournament!.id,
        lines,
        lockedAt: lock ? now : (ownLineup?.lockedAt ?? null),
        submittedBy: user.uid,
        updatedAt: now,
      });
      setOwnLineup(saved);
      if (lock) await writeAuditLog(tournament!.id, 'LINEUP_LOCKED', { uid: user.uid, email: user.email }, 'lineup', saved.id, { scheduleEntryId: selectedEntry.id, teamId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const allLinesFilled = lineSpecs.every((spec) => (selections[spec.label]?.filter(Boolean).length ?? 0) === spec.playersPerSide);
  const locked = Boolean(ownLineup?.lockedAt);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Submit Lineup"
        subtitle="Your lineup stays hidden from your opponent until you both lock — and theirs stays hidden from you until then too."
      />

      {entries.length === 0 && <Typography color="text.secondary">No upcoming scheduled matches.</Typography>}
      {entries.length > 0 && (
        <Select value={selectedEntryId} displayEmpty onChange={(e) => setSelectedEntryId(e.target.value)}>
          <MenuItem value="" disabled>Select a match</MenuItem>
          {entries.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              vs {teams[e.team1Id === teamId ? e.team2Id : e.team1Id]?.name ?? '—'} — {e.date}
            </MenuItem>
          ))}
        </Select>
      )}

      {selectedEntry && roster.length > 0 && (
        <>
          {lineSpecs.map((spec) => (
            <Stack key={spec.label} spacing={1} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle1">{spec.label}</Typography>
              {Array.from({ length: spec.playersPerSide }).map((_, i) => (
                <Select
                  key={i} size="small" displayEmpty disabled={locked}
                  value={selections[spec.label]?.[i] ?? ''}
                  onChange={(e) => setSelections((prev) => {
                    const next = [...(prev[spec.label] ?? Array(spec.playersPerSide).fill(''))];
                    next[i] = e.target.value;
                    return { ...prev, [spec.label]: next };
                  })}
                >
                  <MenuItem value="" disabled>Select player</MenuItem>
                  {roster.map((p) => <MenuItem key={p.id} value={p.id}>{p.displayName}</MenuItem>)}
                </Select>
              ))}
            </Stack>
          ))}

          {error && <Alert severity="error">{error}</Alert>}

          {!locked ? (
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" disabled={saving} onClick={() => handleSave(false)}>Save Draft</Button>
              <Button variant="contained" disabled={saving || !allLinesFilled} onClick={() => handleSave(true)}>
                {saving ? 'Locking…' : 'Lock Lineup'}
              </Button>
            </Stack>
          ) : revealed ? (
            <Alert severity="success">
              Both lineups are locked and revealed. Head to Enter Score once the match is played.
            </Alert>
          ) : (
            <Alert severity="info">Your lineup is locked. Waiting for your opponent to lock theirs.</Alert>
          )}

          {revealed && opponentLineup && (
            <Stack spacing={1}>
              <Typography variant="h6">Opponent's Lineup</Typography>
              {opponentLineup.lines.map((line) => (
                <Typography key={line.label}>{line.label}: {line.playerIds.length} player(s) selected</Typography>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}

export default function LineupSubmissionPage() {
  return (
    <Container sx={{ py: 4 }}>
      <VisibilityGate pageId="lineupSubmission">
        <LineupContent />
      </VisibilityGate>
    </Container>
  );
}
