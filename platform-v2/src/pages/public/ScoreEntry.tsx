import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Container, FormControlLabel, MenuItem, Select, Stack,
  TextField, Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import type { LineupSubmission, Match, MatchLine, Player, ScheduleEntry, SetScore, Team } from '@/types';
import { lineupDocId } from '@/types';
import { buildLineSpecs, type LineSpec } from '@/services/matchLines';
import { validateLine, lineWinner } from '@/services/scoringEngine';
import { writeAuditLog } from '@/services/auditService';

interface DraftSet {
  team1: string;
  team2: string;
  tiebreak: { team1: string; team2: string } | null;
  isMatchTiebreak: boolean;
}

function emptySet(): DraftSet {
  return { team1: '', team2: '', tiebreak: null, isMatchTiebreak: false };
}

function toSetScore(draft: DraftSet): SetScore {
  const team1 = Number(draft.team1) || 0;
  const team2 = Number(draft.team2) || 0;
  if (draft.isMatchTiebreak) {
    return { set: 0, team1: 0, team2: 0, matchTiebreak: { team1, team2 } };
  }
  const set: SetScore = { set: 0, team1, team2 };
  if (draft.tiebreak) set.tiebreak = { team1: Number(draft.tiebreak.team1) || 0, team2: Number(draft.tiebreak.team2) || 0 };
  return set;
}

function SetRow({
  index, draft, onChange, gamesPerSet,
}: { index: number; draft: DraftSet; onChange: (next: DraftSet) => void; gamesPerSet: number }) {
  const showTiebreakPrompt = !draft.isMatchTiebreak && Number(draft.team1) === gamesPerSet - 1 && Number(draft.team2) === gamesPerSet - 1;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ width: 48 }}>Set {index + 1}</Typography>
      <FormControlLabel
        control={<Checkbox size="small" checked={draft.isMatchTiebreak} onChange={(e) => onChange({ ...draft, isMatchTiebreak: e.target.checked, tiebreak: null })} />}
        label="Match TB"
      />
      <TextField size="small" type="number" label="T1" sx={{ width: 80 }}
        value={draft.isMatchTiebreak ? draft.team1 : draft.team1}
        onChange={(e) => onChange({ ...draft, team1: e.target.value })} />
      <TextField size="small" type="number" label="T2" sx={{ width: 80 }}
        value={draft.team2}
        onChange={(e) => onChange({ ...draft, team2: e.target.value })} />
      {(showTiebreakPrompt || draft.tiebreak) && !draft.isMatchTiebreak && (
        <>
          <Typography variant="body2">TB:</Typography>
          <TextField size="small" type="number" sx={{ width: 70 }}
            value={draft.tiebreak?.team1 ?? ''}
            onChange={(e) => onChange({ ...draft, tiebreak: { team1: e.target.value, team2: draft.tiebreak?.team2 ?? '' } })} />
          <TextField size="small" type="number" sx={{ width: 70 }}
            value={draft.tiebreak?.team2 ?? ''}
            onChange={(e) => onChange({ ...draft, tiebreak: { team1: draft.tiebreak?.team1 ?? '', team2: e.target.value } })} />
        </>
      )}
    </Stack>
  );
}

function LineForm({
  spec, team1, team2, team1Players, team2Players, gamesPerSet, maxSets, onValidChange,
  prefillTeam1PlayerIds, prefillTeam2PlayerIds,
}: {
  spec: LineSpec; team1: Team; team2: Team; team1Players: Player[]; team2Players: Player[];
  gamesPerSet: number; maxSets: number;
  onValidChange: (line: MatchLine | null, errors: string[]) => void;
  prefillTeam1PlayerIds?: string[]; prefillTeam2PlayerIds?: string[];
}) {
  // Prefilled from a revealed lineup submission (both teams locked) when available —
  // see hooks usage in ScoreEntryContent — otherwise starts blank as before.
  const [team1PlayerIds, setTeam1PlayerIds] = useState<string[]>(
    () => prefillTeam1PlayerIds && prefillTeam1PlayerIds.length === spec.playersPerSide
      ? prefillTeam1PlayerIds
      : Array(spec.playersPerSide).fill('')
  );
  const [team2PlayerIds, setTeam2PlayerIds] = useState<string[]>(
    () => prefillTeam2PlayerIds && prefillTeam2PlayerIds.length === spec.playersPerSide
      ? prefillTeam2PlayerIds
      : Array(spec.playersPerSide).fill('')
  );
  const [sets, setSets] = useState<DraftSet[]>(Array.from({ length: maxSets }, emptySet));

  useEffect(() => {
    const activeSets = sets.filter((s) => s.team1 !== '' || s.team2 !== '');
    if (activeSets.length === 0 || team1PlayerIds.some((p) => !p) || team2PlayerIds.some((p) => !p)) {
      onValidChange(null, []);
      return;
    }
    const setScores = activeSets.map(toSetScore);
    // scoring validation happens where the ScoringConfig is in scope (parent) — this
    // component just reports the raw line shape upward.
    const winner = lineWinner(setScores);
    const line: MatchLine = {
      label: spec.label,
      type: spec.matchType,
      team1PlayerIds,
      team2PlayerIds,
      sets: setScores,
      status: winner ? 'COMPLETED' : 'SCHEDULED',
    };
    onValidChange(line, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team1PlayerIds, team2PlayerIds, sets]);

  return (
    <Stack spacing={1.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle1">{spec.label}</Typography>
      <Stack direction="row" spacing={4}>
        <Stack spacing={1}>
          <Typography variant="caption">{team1.name}</Typography>
          {Array.from({ length: spec.playersPerSide }).map((_, i) => (
            <Select key={i} size="small" value={team1PlayerIds[i]} displayEmpty
              onChange={(e) => setTeam1PlayerIds((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}>
              <MenuItem value="" disabled>Select player</MenuItem>
              {team1Players.map((p) => <MenuItem key={p.id} value={p.id}>{p.displayName}</MenuItem>)}
            </Select>
          ))}
        </Stack>
        <Stack spacing={1}>
          <Typography variant="caption">{team2.name}</Typography>
          {Array.from({ length: spec.playersPerSide }).map((_, i) => (
            <Select key={i} size="small" value={team2PlayerIds[i]} displayEmpty
              onChange={(e) => setTeam2PlayerIds((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}>
              <MenuItem value="" disabled>Select player</MenuItem>
              {team2Players.map((p) => <MenuItem key={p.id} value={p.id}>{p.displayName}</MenuItem>)}
            </Select>
          ))}
        </Stack>
      </Stack>
      {sets.map((set, i) => (
        <SetRow key={i} index={i} draft={set} gamesPerSet={gamesPerSet}
          onChange={(next) => setSets((prev) => prev.map((s, idx) => (idx === i ? next : s)))} />
      ))}
    </Stack>
  );
}

function ScoreEntryContent() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const { teamId, role } = useTournamentRole();
  const isAdminEntry = role === 'TOURNAMENT_ADMIN' || role === 'ORGANIZER';
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [lines, setLines] = useState<Record<string, { line: MatchLine | null; errors: string[] }>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([repo<ScheduleEntry>('schedules').list(), repo<Team>('teams').list()]).then(([schedules, teamList]) => {
      const teamMap = Object.fromEntries(teamList.map((t) => [t.id, t]));
      setTeams(teamMap);
      setEntries(schedules.filter((e) => e.status === 'SCHEDULED' && (!teamId || e.team1Id === teamId || e.team2Id === teamId)));
    });
  }, [tournament, repo, teamId]);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null;
  const team1 = selectedEntry ? teams[selectedEntry.team1Id] : null;
  const team2 = selectedEntry ? teams[selectedEntry.team2Id] : null;
  const [revealedLineups, setRevealedLineups] = useState<{ team1: LineupSubmission; team2: LineupSubmission } | null>(null);

  useEffect(() => {
    if (!team1 || !team2) return;
    Promise.all(
      [team1, team2].map((t) => Promise.all(t.playerIds.map((id) => repo<Player>('players').get(id))))
    ).then(([p1, p2]) => {
      setPlayers({ [team1.id]: p1.filter((p): p is Player => Boolean(p)), [team2.id]: p2.filter((p): p is Player => Boolean(p)) });
    });
  }, [team1, team2, repo]);

  // If both teams have locked a pre-match lineup (see pages/public/LineupSubmission.tsx),
  // prefill the score-entry player selects from it instead of making the entrant re-pick
  // players that were already agreed on and revealed.
  useEffect(() => {
    setRevealedLineups(null);
    if (!selectedEntry || !team1 || !team2) return;
    const lineupRepo = repo<LineupSubmission>('lineups');
    Promise.all([
      lineupRepo.get(lineupDocId(selectedEntry.id, team1.id)).catch(() => null),
      lineupRepo.get(lineupDocId(selectedEntry.id, team2.id)).catch(() => null),
    ]).then(([l1, l2]) => {
      if (l1?.lockedAt && l2?.lockedAt) setRevealedLineups({ team1: l1, team2: l2 });
    });
  }, [selectedEntry, team1, team2, repo]);

  const lineSpecs = useMemo(() => (tournament ? buildLineSpecs(tournament.config) : []), [tournament]);

  if (!tournament) return null;
  const { scoring } = tournament.config;
  const maxSets = scoring.setsToWin * 2 - 1;

  const allLinesReady = lineSpecs.length > 0 && lineSpecs.every((spec) => lines[spec.label]?.line);
  const validationErrors = lineSpecs.flatMap((spec) => {
    const line = lines[spec.label]?.line;
    return line ? validateLine(spec.label, line.sets, scoring) : [];
  });

  const handleSubmit = async () => {
    if (!selectedEntry || !team1 || !team2) return;
    setSubmitting(true);
    setSubmitError(null);
    const finalLines = lineSpecs.map((spec) => lines[spec.label].line!);
    let team1Wins = 0, team2Wins = 0;
    finalLines.forEach((line) => {
      const w = lineWinner(line.sets);
      if (w === 1) team1Wins += 1; else if (w === 2) team2Wins += 1;
    });
    const winnerTeamId = team1Wins > team2Wins ? team1.id : team2Wins > team1Wins ? team2.id : null;
    const now = Date.now();

    try {
      // Admin-entered scores are trusted and go straight to APPROVED; a captain's
      // submission is PENDING_APPROVAL until an admin reviews it (see
      // pages/admin/ApproveScores.tsx) — matches koc3-app's PENDING -> APPROVED convention,
      // which the earlier version of this file skipped.
      const match = await repo<Match>('matches').create({
        scheduleEntryId: selectedEntry.id,
        team1Id: team1.id,
        team2Id: team2.id,
        lines: finalLines,
        winnerTeamId,
        status: isAdminEntry ? 'APPROVED' : 'PENDING_APPROVAL',
        enteredBy: user?.uid ?? null,
        approvedBy: isAdminEntry ? (user?.uid ?? null) : null,
        playedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await repo<ScheduleEntry>('schedules').update(selectedEntry.id, { status: 'PLAYED', matchId: match.id });
      if (user) await writeAuditLog(tournament.id, 'SCORE_SAVED', { uid: user.uid, email: user.email }, 'match', match.id, { winnerTeamId, status: match.status });
      setSuccess(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Enter Score</Typography>
      {entries.length === 0 && <Typography color="text.secondary">No scheduled matches to enter right now.</Typography>}
      {entries.length > 0 && (
        <Select value={selectedEntryId} displayEmpty onChange={(e) => { setSelectedEntryId(e.target.value); setLines({}); setSuccess(false); }}>
          <MenuItem value="" disabled>Select a match</MenuItem>
          {entries.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {teams[e.team1Id]?.name ?? e.team1Id} vs {teams[e.team2Id]?.name ?? e.team2Id} — {e.date}
            </MenuItem>
          ))}
        </Select>
      )}

      {selectedEntry && team1 && team2 && players[team1.id] && players[team2.id] && (
        <>
          {revealedLineups && (
            <Alert severity="info">Player selections below are prefilled from the revealed, locked lineups — change them if needed.</Alert>
          )}
          {lineSpecs.map((spec) => (
            <LineForm
              key={spec.label}
              spec={spec}
              team1={team1}
              team2={team2}
              team1Players={players[team1.id]}
              team2Players={players[team2.id]}
              gamesPerSet={scoring.gamesPerSet}
              maxSets={maxSets}
              onValidChange={(line, errors) => setLines((prev) => ({ ...prev, [spec.label]: { line, errors } }))}
              prefillTeam1PlayerIds={revealedLineups?.team1.lines.find((l) => l.label === spec.label)?.playerIds}
              prefillTeam2PlayerIds={revealedLineups?.team2.lines.find((l) => l.label === spec.label)?.playerIds}
            />
          ))}

          {validationErrors.length > 0 && <Alert severity="warning">{validationErrors.join(' · ')}</Alert>}
          {submitError && <Alert severity="error">{submitError}</Alert>}
          {success && (
            <Alert severity="success">
              {isAdminEntry ? 'Score saved and approved.' : 'Score submitted — an admin needs to approve it before it counts in standings.'}
            </Alert>
          )}

          <Box>
            <Button
              variant="contained"
              disabled={!allLinesReady || validationErrors.length > 0 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Saving…' : 'Save Score'}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
}

export default function ScoreEntry() {
  return (
    <Container sx={{ py: 4 }}>
      <VisibilityGate pageId="scoreEntry">
        <ScoreEntryContent />
      </VisibilityGate>
    </Container>
  );
}
