import type { ScoringConfig, SetScore } from '@/types';

// Set/game/tiebreak validation driven entirely by ScoringConfig — no hardcoded thresholds.
// Same design as the koc3-app PR's utils/tennisScoreRules.js, generalized from day one here
// since ScoringConfig already models gamesPerSet/setsToWin/tiebreak thresholds as data.

export function regularSetWinner(a: number, b: number, gamesPerSet: number): 1 | 2 | null {
  if (a === gamesPerSet && b >= 0 && b <= gamesPerSet - 1) return 1;
  if (b === gamesPerSet && a >= 0 && a <= gamesPerSet - 1) return 2;
  return null;
}

export function isValidTiebreakScore(winnerPoints: number, loserPoints: number, minPoints: number, winBy: number): boolean {
  return winnerPoints >= minPoints && winnerPoints - loserPoints >= winBy;
}

function regularSetScoreOptions(gamesPerSet: number): string {
  const opts = Array.from({ length: gamesPerSet }, (_, i) => `${gamesPerSet}-${i}`);
  return opts.length > 1 ? `${opts.slice(0, -1).join(', ')} or ${opts[opts.length - 1]}` : opts[0];
}

export function buildScoreErrors(config: ScoringConfig) {
  return {
    regularSet: `Only ${regularSetScoreOptions(config.gamesPerSet)} are valid set scores.`,
    tieRequired: `${config.gamesPerSet}-${config.gamesPerSet - 1} requires a tiebreak score.`,
    tieInvalid: `Tiebreak winner must reach ${config.setTiebreakMinPoints} points and win by ${config.setTiebreakWinBy}.`,
    matchTieInvalid: `Match tiebreak winner must reach ${config.matchTiebreakMinPoints} points and win by ${config.matchTiebreakWinBy}.`,
    incompleteMatch: `Match isn't complete — winner must win ${config.setsToWin} sets.`,
  };
}

function validateRegularSet(set: SetScore, label: string, errors: string[], config: ScoringConfig, messages: ReturnType<typeof buildScoreErrors>): 1 | 2 | null {
  const winner = regularSetWinner(set.team1, set.team2, config.gamesPerSet);
  if (!winner) {
    errors.push(`${label}: ${messages.regularSet}`);
    return null;
  }
  if (Math.max(set.team1, set.team2) === config.gamesPerSet && Math.min(set.team1, set.team2) === config.gamesPerSet - 1) {
    const tb = set.tiebreak;
    if (!tb) {
      errors.push(`${label}: ${messages.tieRequired}`);
      return winner;
    }
    const tbWinner = tb.team1 > tb.team2 ? 1 : 2;
    const winnerPoints = Math.max(tb.team1, tb.team2);
    const loserPoints = Math.min(tb.team1, tb.team2);
    if (tbWinner !== winner || !isValidTiebreakScore(winnerPoints, loserPoints, config.setTiebreakMinPoints, config.setTiebreakWinBy)) {
      errors.push(`${label}: ${messages.tieInvalid}`);
    }
  }
  return winner;
}

function validateMatchTiebreakSet(set: SetScore, label: string, errors: string[], config: ScoringConfig, messages: ReturnType<typeof buildScoreErrors>): 1 | 2 | null {
  const mt = set.matchTiebreak ?? { team1: set.team1, team2: set.team2 };
  const winner = mt.team1 > mt.team2 ? 1 : mt.team2 > mt.team1 ? 2 : null;
  const winnerPoints = Math.max(mt.team1, mt.team2);
  const loserPoints = Math.min(mt.team1, mt.team2);
  if (!winner || !isValidTiebreakScore(winnerPoints, loserPoints, config.matchTiebreakMinPoints, config.matchTiebreakWinBy)) {
    errors.push(`${label}: ${messages.matchTieInvalid}`);
  }
  return winner;
}

/** Validates a full line's set scores against ScoringConfig, returning error strings (empty = valid). */
export function validateLine(label: string, sets: SetScore[], config: ScoringConfig): string[] {
  const errors: string[] = [];
  const messages = buildScoreErrors(config);
  let s1 = 0, s2 = 0;

  sets.forEach((set, idx) => {
    // A match-tiebreak-decided set is only meaningful as the deciding set when the format
    // allows the match to end in a single tiebreak game instead of a full set (tiebreakFormat
    // TEN_POINT with an odd number of prior sets split evenly).
    const isDecidingTiebreak = config.tiebreakFormat !== 'NONE' && idx === sets.length - 1 && Boolean(set.matchTiebreak);
    const winner = isDecidingTiebreak
      ? validateMatchTiebreakSet(set, label, errors, config, messages)
      : validateRegularSet(set, label, errors, config, messages);
    if (winner === 1) s1 += 1;
    if (winner === 2) s2 += 1;
  });

  if (Math.max(s1, s2) !== config.setsToWin || Math.min(s1, s2) >= config.setsToWin) {
    errors.push(`${label}: ${messages.incompleteMatch}`);
  }
  return [...new Set(errors)];
}

export function lineWinner(sets: SetScore[]): 1 | 2 | null {
  let s1 = 0, s2 = 0;
  sets.forEach((set) => {
    const mt = set.matchTiebreak;
    if (mt) {
      if (mt.team1 > mt.team2) s1 += 1; else if (mt.team2 > mt.team1) s2 += 1;
    } else if (set.team1 > set.team2) {
      s1 += 1;
    } else if (set.team2 > set.team1) {
      s2 += 1;
    }
  });
  return s1 > s2 ? 1 : s2 > s1 ? 2 : null;
}
