import type { Match, StandingsConfig, StandingsCriterion, Team } from '@/types';

export interface StandingsRow {
  teamId: string;
  team: Team;
  group: string | null;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  bonusPoints: number;
  penaltyPoints: number;
  setDiff: number;
  gameDiff: number;
  percentage: number;
}

function emptyRow(team: Team): StandingsRow {
  return {
    teamId: team.id, team, group: team.group,
    played: 0, wins: 0, losses: 0, points: 0,
    setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
    bonusPoints: 0, penaltyPoints: 0, setDiff: 0, gameDiff: 0, percentage: 0,
  };
}

function setAndGameTotals(match: Match, teamId: string): { setsFor: number; setsAgainst: number; gamesFor: number; gamesAgainst: number } {
  let setsFor = 0, setsAgainst = 0, gamesFor = 0, gamesAgainst = 0;
  const isTeam1 = match.team1Id === teamId;
  match.lines.forEach((line) => {
    line.sets.forEach((set) => {
      const mine = isTeam1 ? set.team1 : set.team2;
      const theirs = isTeam1 ? set.team2 : set.team1;
      gamesFor += mine;
      gamesAgainst += theirs;
      if (mine > theirs) setsFor += 1;
      else if (theirs > mine) setsAgainst += 1;
    });
  });
  return { setsFor, setsAgainst, gamesFor, gamesAgainst };
}

/** Only APPROVED matches count toward standings — mirrors the koc3-app convention that a
 * submitted-but-unapproved score shouldn't move the table. */
function isCountable(match: Match): boolean {
  return match.status === 'APPROVED';
}

const CRITERION_COMPARATORS: Record<StandingsCriterion, (a: StandingsRow, b: StandingsRow, headToHead: Record<string, number>) => number> = {
  WINS: (a, b) => b.wins - a.wins,
  LOSSES: (a, b) => a.losses - b.losses,
  POINTS: (a, b) => b.points - a.points,
  SETS_WON: (a, b) => b.setsWon - a.setsWon,
  SETS_LOST: (a, b) => a.setsLost - b.setsLost,
  GAME_DIFF: (a, b) => b.gameDiff - a.gameDiff,
  GAMES_WON: (a, b) => b.gamesWon - a.gamesWon,
  GAMES_LOST: (a, b) => a.gamesLost - b.gamesLost,
  HEAD_TO_HEAD: (a, b, h2h) => (h2h[`${b.teamId}:${a.teamId}`] || 0) - (h2h[`${a.teamId}:${b.teamId}`] || 0),
  PERCENTAGE: (a, b) => b.percentage - a.percentage,
  BONUS_POINTS: (a, b) => b.bonusPoints - a.bonusPoints,
  PENALTY_POINTS: (a, b) => a.penaltyPoints - b.penaltyPoints,
  // Arbitrary admin-authored formulas aren't evaluated client-side (no safe eval sandbox
  // wired up) — treated as a no-op tiebreak step rather than silently mis-ranking teams.
  CUSTOM_FORMULA: () => 0,
};

export function buildStandingsComparator(order: StandingsCriterion[], headToHead: Record<string, number>) {
  return (a: StandingsRow, b: StandingsRow): number => {
    for (const criterion of order) {
      const result = CRITERION_COMPARATORS[criterion]?.(a, b, headToHead) ?? 0;
      if (result) return result;
    }
    return a.team.name.localeCompare(b.team.name);
  };
}

export function computeStandings(teams: Team[], matches: Match[], config: StandingsConfig): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(teams.map((t) => [t.id, emptyRow(t)]));
  const headToHead: Record<string, number> = {};

  matches.filter(isCountable).forEach((match) => {
    const row1 = rows.get(match.team1Id);
    const row2 = rows.get(match.team2Id);
    if (!row1 || !row2) return;

    const t1 = setAndGameTotals(match, match.team1Id);
    const t2 = setAndGameTotals(match, match.team2Id);
    row1.setsWon += t1.setsFor; row1.setsLost += t1.setsAgainst; row1.gamesWon += t1.gamesFor; row1.gamesLost += t1.gamesAgainst;
    row2.setsWon += t2.setsFor; row2.setsLost += t2.setsAgainst; row2.gamesWon += t2.gamesFor; row2.gamesLost += t2.gamesAgainst;
    row1.played += 1; row2.played += 1;

    if (match.winnerTeamId === match.team1Id) {
      row1.wins += 1; row1.points += config.pointsPerWin; row2.losses += 1; row2.points += config.pointsPerLoss;
      headToHead[`${match.team1Id}:${match.team2Id}`] = (headToHead[`${match.team1Id}:${match.team2Id}`] || 0) + 1;
    } else if (match.winnerTeamId === match.team2Id) {
      row2.wins += 1; row2.points += config.pointsPerWin; row1.losses += 1; row1.points += config.pointsPerLoss;
      headToHead[`${match.team2Id}:${match.team1Id}`] = (headToHead[`${match.team2Id}:${match.team1Id}`] || 0) + 1;
    }
  });

  const result = Array.from(rows.values()).map((r) => ({
    ...r,
    setDiff: r.setsWon - r.setsLost,
    gameDiff: r.gamesWon - r.gamesLost,
    percentage: r.played > 0 ? r.wins / r.played : 0,
  }));

  const comparator = buildStandingsComparator(config.tiebreakOrder, headToHead);
  return result.sort(comparator);
}

export function groupStandings(rows: StandingsRow[]): Record<string, StandingsRow[]> {
  const byGroup: Record<string, StandingsRow[]> = {};
  rows.forEach((row) => {
    const key = row.group ?? 'Unassigned';
    (byGroup[key] ||= []).push(row);
  });
  return byGroup;
}
