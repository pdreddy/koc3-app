import type { Match, MatchLine } from '@/types';
import { lineWinner } from './scoringEngine';

export interface PlayerStatRow {
  playerId: string;
  matchDaysPlayed: number;
  wins: number;
  losses: number;
  singlesRecord: { wins: number; losses: number };
  doublesRecord: { wins: number; losses: number };
}

export interface PartnershipRow {
  key: string; // sorted player ids joined by '_'
  playerIds: [string, string];
  matchesPlayed: number;
  wins: number;
  losses: number;
}

function isCountable(match: Match): boolean {
  return match.status === 'APPROVED';
}

function sideKey(playerIds: string[]): string {
  return [...playerIds].sort().join('_');
}

/** Per-player win/loss record across all counted lines (singles + doubles), keyed by
 * player id. A player appears once per line they're listed on, not once per match. */
export function computePlayerStats(matches: Match[]): Record<string, PlayerStatRow> {
  const rows: Record<string, PlayerStatRow> = {};

  const ensure = (playerId: string): PlayerStatRow => {
    if (!rows[playerId]) {
      rows[playerId] = { playerId, matchDaysPlayed: 0, wins: 0, losses: 0, singlesRecord: { wins: 0, losses: 0 }, doublesRecord: { wins: 0, losses: 0 } };
    }
    return rows[playerId];
  };

  matches.filter(isCountable).forEach((match) => {
    const daySeen = new Set<string>();
    match.lines.forEach((line: MatchLine) => {
      const winnerSide = lineWinner(line.sets);
      if (!winnerSide) return;
      const isSingles = line.type === 'SINGLES' || line.type === 'REVERSE_SINGLES';
      [[line.team1PlayerIds, 1], [line.team2PlayerIds, 2]].forEach(([playerIds, side]) => {
        (playerIds as string[]).forEach((playerId) => {
          const row = ensure(playerId);
          const won = winnerSide === side;
          row.wins += won ? 1 : 0;
          row.losses += won ? 0 : 1;
          const bucket = isSingles ? row.singlesRecord : row.doublesRecord;
          bucket[won ? 'wins' : 'losses'] += 1;
          daySeen.add(playerId);
        });
      });
    });
    daySeen.forEach((playerId) => { ensure(playerId).matchDaysPlayed += 1; });
  });

  return rows;
}

/** Doubles-only partnership records: how often two specific players played together and
 * their combined record as a pair. */
export function computePartnerships(matches: Match[]): PartnershipRow[] {
  const rows: Record<string, PartnershipRow> = {};

  matches.filter(isCountable).forEach((match) => {
    match.lines.forEach((line) => {
      if (line.type !== 'DOUBLES' && line.type !== 'REVERSE_DOUBLES' && line.type !== 'MIXED_DOUBLES') return;
      const winnerSide = lineWinner(line.sets);
      [[line.team1PlayerIds, 1], [line.team2PlayerIds, 2]].forEach(([playerIds, side]) => {
        const ids = playerIds as string[];
        if (ids.length !== 2) return;
        const key = sideKey(ids);
        const row = rows[key] ?? { key, playerIds: [...ids].sort() as [string, string], matchesPlayed: 0, wins: 0, losses: 0 };
        row.matchesPlayed += 1;
        if (winnerSide === side) row.wins += 1;
        else if (winnerSide) row.losses += 1;
        rows[key] = row;
      });
    });
  });

  return Object.values(rows).sort((a, b) => b.matchesPlayed - a.matchesPlayed);
}

/** Simplified win-percentage-derived rating, NOT the original koc3-app PTL/PPRC algorithm
 * (that formula wasn't ported — only the display concept). Scaled to a familiar-looking
 * 0-10 range: rating = 5 + 5 * (winPct - 0.5), so a .500 record sits at 5.0. */
export function computeSimpleRating(row: PlayerStatRow): number {
  const total = row.wins + row.losses;
  if (total === 0) return 5;
  const winPct = row.wins / total;
  return Math.round((5 + 5 * (winPct - 0.5)) * 100) / 100;
}
