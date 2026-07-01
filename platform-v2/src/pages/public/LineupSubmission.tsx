import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Container, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from '@/hooks/useTournamentRole';
import type { LineupSubmission, Match, Player, ScheduleEntry, Team } from '@/types';
import { lineupDocId } from '@/types';
import { buildLineSpecs } from '@/services/matchLines';
import { writeAuditLog } from '@/services/auditService';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  buildCapacityMap, getPartnerWarning, getSlotWarnings, resolveEligibilityConfig,
  type CapacityMap, type FixtureRecord,
} from '@/services/eligibilityEngine';
import { buildWhatsAppShareUrl } from '@/services/shareService';

function ownLinesFromMatch(match: Match, teamId: string): { playerIds: string[]; isSingles: boolean }[] {
  const isTeam1 = match.team1Id === teamId;
  return match.lines.map((line) => ({
    playerIds: isTeam1 ? line.team1PlayerIds : line.team2PlayerIds,
    isSingles: line.team1PlayerIds.length <= 1,
  }));
}

function ownLinesFromLineup(lineup: LineupSubmission): { playerIds: string[]; isSingles: boolean }[] {
  return lineup.lines.map((line) => ({ playerIds: line.playerIds, isSingles: line.playerIds.length <= 1 }));
}

function CapacityTable({ capacity, players, config }: { capacity: CapacityMap; players: Player[]; config: ReturnType<typeof resolveEligibilityConfig> }) {
  const rows = players
    .map((p) => ({ player: p, cap: capacity[p.id] }))
    .filter((r) => r.cap && (r.cap.totalDays > 0 || r.cap.singlesDays > 0));
  if (rows.length === 0) return null;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Team Capacity (before this fixture)</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell align="right">Singles</TableCell>
            <TableCell align="right">Total Days</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ player, cap }) => (
            <TableRow key={player.id}>
              <TableCell>{player.displayName}</TableCell>
              <TableCell align="right">{cap!.singlesDays}{config.maxSinglesDaysPerPlayer != null ? ` / ${config.maxSinglesDaysPerPlayer}` : ''}</TableCell>
              <TableCell align="right">{cap!.totalDays}{config.maxTotalMatchDaysPerPlayer != null ? ` / ${config.maxTotalMatchDaysPerPlayer}` : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

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
  const [capacity, setCapacity] = useState<CapacityMap>({});
  const [opponentPlayerNames, setOpponentPlayerNames] = useState<Record<string, string>>({});

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

  // Builds this team's capacity from every OTHER fixture: prefer an APPROVED Match's
  // actual lines (real play) over a merely-locked LineupSubmission (a plan) when both
  // exist for the same scheduleEntryId — see services/eligibilityEngine.ts.
  useEffect(() => {
    if (!tournament || !teamId) return;
    Promise.all([repo<Match>('matches').list(), repo<LineupSubmission>('lineups').list()]).then(([matches, lineups]) => {
      const byFixture = new Map<string, FixtureRecord>();
      lineups
        .filter((l) => l.teamId === teamId && l.lockedAt != null && l.scheduleEntryId !== selectedEntryId)
        .forEach((l) => byFixture.set(l.scheduleEntryId, { scheduleEntryId: l.scheduleEntryId, lines: ownLinesFromLineup(l) }));
      matches
        .filter((m) => m.status === 'APPROVED' && (m.team1Id === teamId || m.team2Id === teamId) && m.scheduleEntryId && m.scheduleEntryId !== selectedEntryId)
        .forEach((m) => byFixture.set(m.scheduleEntryId!, { scheduleEntryId: m.scheduleEntryId!, lines: ownLinesFromMatch(m, teamId) }));
      setCapacity(buildCapacityMap(Array.from(byFixture.values())));
    });
  }, [tournament, teamId, repo, selectedEntryId]);

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
        .then(async (opp) => {
          setOpponentLineup(opp);
          // Players are publicly readable (firestore.rules), so once the opponent's
          // lineup itself is revealed we can also resolve their player ids to names for
          // the WhatsApp share text, without needing their whole roster.
          if (opp) {
            const ids = Array.from(new Set(opp.lines.flatMap((l) => l.playerIds)));
            const players = await Promise.all(ids.map((id) => repo<Player>('players').get(id)));
            setOpponentPlayerNames(Object.fromEntries(players.filter((p): p is Player => Boolean(p)).map((p) => [p.id, p.displayName])));
          }
        })
        .catch(() => setOpponentLineup(null)); // denied until both locked — expected, not an error
    }
  }, [selectedEntry, teamId, opponentTeamId, repo]);

  const lineSpecs = useMemo(() => (tournament ? buildLineSpecs(tournament.config) : []), [tournament]);
  const slotSpecs = useMemo(() => lineSpecs.map((s) => ({ label: s.label, isSingles: s.playersPerSide === 1 })), [lineSpecs]);
  const eligibility = resolveEligibilityConfig(tournament?.config.eligibility);
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

  const shareUrl = revealed && opponentTeamId
    ? buildWhatsAppShareUrl({
        team1Name: teams[teamId!]?.name ?? 'Your team',
        team2Name: teams[opponentTeamId]?.name ?? 'Opponent',
        lines: lineSpecs.map((spec) => ({
          label: spec.label,
          team1Players: (selections[spec.label] ?? []).map((id) => roster.find((p) => p.id === id)?.displayName ?? id),
          team2Players: (opponentLineup?.lines.find((l) => l.label === spec.label)?.playerIds ?? []).map((id) => opponentPlayerNames[id] ?? id),
        })),
      })
    : null;

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
          <CapacityTable capacity={capacity} players={roster} config={eligibility} />

          {lineSpecs.map((spec) => {
            const isSingles = spec.playersPerSide === 1;
            const slotSelections = selections[spec.label] ?? Array(spec.playersPerSide).fill('');
            return (
              <Stack key={spec.label} spacing={1} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle1">{spec.label}</Typography>
                {Array.from({ length: spec.playersPerSide }).map((_, i) => {
                  const chosen = slotSelections[i];
                  return (
                    <Select
                      key={i} size="small" displayEmpty disabled={locked}
                      value={chosen ?? ''}
                      onChange={(e) => setSelections((prev) => {
                        const next = [...(prev[spec.label] ?? Array(spec.playersPerSide).fill(''))];
                        next[i] = e.target.value;
                        return { ...prev, [spec.label]: next };
                      })}
                    >
                      <MenuItem value="" disabled>Select player</MenuItem>
                      {roster.map((p) => {
                        const warnings = getSlotWarnings(p.id, spec.label, slotSpecs, capacity, eligibility, selections);
                        return (
                          <MenuItem key={p.id} value={p.id}>
                            {warnings.length > 0 ? `⚠️ ${p.displayName}` : p.displayName}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  );
                })}
                {!isSingles && slotSelections[0] && slotSelections[1] && (() => {
                  const partnerWarning = getPartnerWarning(slotSelections[0], slotSelections[1], capacity, eligibility);
                  return partnerWarning ? <Alert severity="warning" sx={{ py: 0 }}>{partnerWarning}</Alert> : null;
                })()}
                {slotSelections.filter(Boolean).map((pid) => {
                  const warnings = getSlotWarnings(pid, spec.label, slotSpecs, capacity, eligibility, selections);
                  return warnings.map((w, wi) => (
                    <Alert key={`${pid}-${wi}`} severity="warning" sx={{ py: 0 }}>
                      {roster.find((p) => p.id === pid)?.displayName}: {w}
                    </Alert>
                  ));
                })}
              </Stack>
            );
          })}

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
                <Typography key={line.label}>
                  {line.label}: {line.playerIds.map((id) => opponentPlayerNames[id] ?? id).join(' / ') || '—'}
                </Typography>
              ))}
              {shareUrl && (
                <Button variant="outlined" color="success" href={shareUrl} target="_blank" rel="noreferrer" sx={{ alignSelf: 'flex-start' }}>
                  Share on WhatsApp
                </Button>
              )}
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
