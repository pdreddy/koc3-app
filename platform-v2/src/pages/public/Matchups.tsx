import { useEffect, useMemo, useState } from 'react';
import {
  Chip, Container, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tab,
  TextField, Typography,
} from '@mui/material';
import { VisibilityGate } from '@/components/layout/VisibilityGate';
import { useTournament } from '@/contexts/TournamentContext';
import type { Match, Player, Team } from '@/types';
import { computePartnerships, computePlayerStats } from '@/services/playerStatsEngine';
import { buildCapacityMap, resolveEligibilityConfig, type FixtureRecord } from '@/services/eligibilityEngine';
import { PageHeader } from '@/components/layout/PageHeader';

function winPctChip(wins: number, losses: number) {
  const total = wins + losses;
  if (total === 0) return <Chip size="small" label="—" />;
  const pct = Math.round((wins / total) * 100);
  const color = pct >= 60 ? 'success' : pct >= 40 ? 'default' : 'error';
  return <Chip size="small" color={color} label={`${pct}%`} />;
}

function buildFixtureRecords(matches: Match[]): FixtureRecord[] {
  return matches
    .filter((m) => m.status === 'APPROVED' && m.scheduleEntryId)
    .map((m) => ({
      scheduleEntryId: m.scheduleEntryId!,
      lines: m.lines.flatMap((line) => [
        { playerIds: line.team1PlayerIds, isSingles: line.team1PlayerIds.length <= 1 },
        { playerIds: line.team2PlayerIds, isSingles: line.team2PlayerIds.length <= 1 },
      ]),
    }));
}

function MatchupsContent() {
  const { tournament, repo, loading: tournamentLoading } = useTournament();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tournamentLoading) return;
    Promise.all([repo<Match>('matches').list(), repo<Player>('players').list(), repo<Team>('teams').list()]).then(([m, p, t]) => {
      setMatches(m);
      setPlayers(Object.fromEntries(p.map((pl) => [pl.id, pl])));
      setTeams(Object.fromEntries(t.map((tm) => [tm.id, tm])));
      setLoading(false);
    });
  }, [repo, tournamentLoading]);

  const eligibility = resolveEligibilityConfig(tournament?.config.eligibility);
  const capacity = useMemo(() => buildCapacityMap(buildFixtureRecords(matches)), [matches]);

  if (loading) return <Typography color="text.secondary">Loading matchups…</Typography>;

  const stats = Object.values(computePlayerStats(matches)).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  const partnerships = computePartnerships(matches);
  const name = (id: string) => players[id]?.displayName ?? id;
  const teamName = (id: string) => teams[players[id]?.teamId ?? '']?.name ?? '—';

  const matchesSearch = (playerId: string, extra?: string) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return name(playerId).toLowerCase().includes(q) || teamName(playerId).toLowerCase().includes(q) || (extra?.toLowerCase().includes(q) ?? false);
  };

  const filteredStats = stats.filter((row) => matchesSearch(row.playerId));
  const filteredPartnerships = partnerships.filter((row) => matchesSearch(row.playerIds[0]) || matchesSearch(row.playerIds[1]));

  return (
    <Stack spacing={2}>
      <TextField size="small" label="Search player or team" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ maxWidth: 320 }} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Player Stats" />
        <Tab label="Singles Cap" />
        <Tab label="Doubles Partnerships" />
      </Tabs>

      {tab === 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell><TableCell>Team</TableCell><TableCell align="right">Match Days</TableCell>
              <TableCell align="right">W-L</TableCell><TableCell align="right">Win%</TableCell>
              <TableCell align="right">Singles</TableCell><TableCell align="right">Doubles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStats.map((row) => (
              <TableRow key={row.playerId}>
                <TableCell>{name(row.playerId)}</TableCell>
                <TableCell>{teamName(row.playerId)}</TableCell>
                <TableCell align="right">{row.matchDaysPlayed}</TableCell>
                <TableCell align="right">{row.wins}-{row.losses}</TableCell>
                <TableCell align="right">{winPctChip(row.wins, row.losses)}</TableCell>
                <TableCell align="right">{row.singlesRecord.wins}-{row.singlesRecord.losses}</TableCell>
                <TableCell align="right">{row.doublesRecord.wins}-{row.doublesRecord.losses}</TableCell>
              </TableRow>
            ))}
            {filteredStats.length === 0 && <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No matches played yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      {tab === 1 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell><TableCell>Team</TableCell>
              <TableCell align="right">Singles Days</TableCell><TableCell align="right">Total Days</TableCell><TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(capacity).filter(([pid]) => matchesSearch(pid)).map(([playerId, cap]) => {
              const singlesMaxed = eligibility.maxSinglesDaysPerPlayer != null && cap.singlesDays >= eligibility.maxSinglesDaysPerPlayer;
              const totalMaxed = eligibility.maxTotalMatchDaysPerPlayer != null && cap.totalDays >= eligibility.maxTotalMatchDaysPerPlayer;
              return (
                <TableRow key={playerId} sx={singlesMaxed || totalMaxed ? { bgcolor: '#fdecea' } : undefined}>
                  <TableCell>{name(playerId)}</TableCell>
                  <TableCell>{teamName(playerId)}</TableCell>
                  <TableCell align="right">{cap.singlesDays}{eligibility.maxSinglesDaysPerPlayer != null ? ` / ${eligibility.maxSinglesDaysPerPlayer}` : ''}</TableCell>
                  <TableCell align="right">{cap.totalDays}{eligibility.maxTotalMatchDaysPerPlayer != null ? ` / ${eligibility.maxTotalMatchDaysPerPlayer}` : ''}</TableCell>
                  <TableCell>
                    {singlesMaxed && <Chip size="small" color="error" label="Singles Maxed" sx={{ mr: 0.5 }} />}
                    {totalMaxed && <Chip size="small" color="error" label="Total Maxed" />}
                    {!singlesMaxed && !totalMaxed && <Chip size="small" label="OK" />}
                  </TableCell>
                </TableRow>
              );
            })}
            {Object.keys(capacity).length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No matches played yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      {tab === 2 && (
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Pair</TableCell><TableCell align="right">Played</TableCell><TableCell align="right">W-L</TableCell><TableCell align="right">Win%</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {filteredPartnerships.map((row) => {
              const partnerMaxed = eligibility.maxPartnerDaysPerPair != null && (capacity[row.playerIds[0]]?.partnerDays[row.playerIds[1]] ?? 0) >= eligibility.maxPartnerDaysPerPair;
              return (
                <TableRow key={row.key} sx={partnerMaxed ? { bgcolor: '#fdecea' } : undefined}>
                  <TableCell>
                    {name(row.playerIds[0])} / {name(row.playerIds[1])}
                    {partnerMaxed && <Chip size="small" color="error" label="Maxed" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell align="right">{row.matchesPlayed}</TableCell>
                  <TableCell align="right">{row.wins}-{row.losses}</TableCell>
                  <TableCell align="right">{winPctChip(row.wins, row.losses)}</TableCell>
                </TableRow>
              );
            })}
            {filteredPartnerships.length === 0 && <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No doubles played yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

export default function Matchups() {
  return (
    <Container sx={{ py: 4 }}>
      <PageHeader title="Matchups" subtitle="Player, singles, and doubles matchup stats." />
      <VisibilityGate pageId="matchups">
        <MatchupsContent />
      </VisibilityGate>
    </Container>
  );
}
