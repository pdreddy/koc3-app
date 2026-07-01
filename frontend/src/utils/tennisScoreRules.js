// Config-driven set/game/tiebreak scoring rules. DEFAULT_MATCH_FORMAT documents KOC's
// exact current format (4-game no-ad sets; singles win 3 of up to 5 sets; doubles win 2
// of up to 3, with a 10-point match tiebreak replacing a split third set). Every function
// here takes an optional `format` argument defaulting to DEFAULT_MATCH_FORMAT, so every
// existing call site (which doesn't pass one) is completely unaffected.
//
// Note: this only generalizes the games-per-set threshold, sets-to-win, and tiebreak
// point/win-by thresholds under KOC's existing "reach N games, opponent has fewer, with a
// single tiebreak game" algorithm. Genuinely different set styles (traditional advantage
// sets, single-tiebreak Pro-8/Pro-10 formats) would need a different validator — out of
// scope for this phase. Match/lineup *structure* (how many lines, the doubles
// cross-pairing "reverse" format, S1/D1/D2 lineup-submission slots validated by the
// Cloud Function) is a separate, more deeply-coupled concern not touched here — see
// memory/MULTI_CLUB_SAAS_PLAN.md.
export const DEFAULT_MATCH_FORMAT = {
  singles: { gamesPerSet: 4, setsToWin: 3, setTiebreak: { minPoints: 7, winBy: 2 } },
  doubles: { gamesPerSet: 4, setsToWin: 2, setTiebreak: { minPoints: 7, winBy: 2 }, matchTiebreak: { minPoints: 10, winBy: 2 } },
};

function regularSetScoreOptions(gamesPerSet) {
  const opts = Array.from({ length: gamesPerSet }, (_, i) => `${gamesPerSet}-${i}`);
  return opts.length > 1 ? `${opts.slice(0, -1).join(', ')} or ${opts[opts.length - 1]}` : opts[0];
}

export function buildScoreErrors(format = DEFAULT_MATCH_FORMAT) {
  const { singles, doubles } = format;
  return {
    regularSet: `Only ${regularSetScoreOptions(singles.gamesPerSet)} are valid set scores.`,
    tieRequired: `${singles.gamesPerSet}-${singles.gamesPerSet - 1} requires a tiebreak score.`,
    tieInvalid: `Tiebreak winner must reach ${singles.setTiebreak.minPoints} points and win by ${singles.setTiebreak.winBy}.`,
    matchTieInvalid: `Match tiebreak winner must reach ${doubles.matchTiebreak.minPoints} points and win by ${doubles.matchTiebreak.winBy}.`,
    singlesSets: `Singles winner must win ${singles.setsToWin} sets.`,
    doublesSets: `Doubles winner must win ${doubles.setsToWin} sets.`,
    doublesThird: `Third set in doubles must be a ${doubles.matchTiebreak.minPoints}-point match tiebreak.`,
  };
}

export const SCORE_ERRORS = buildScoreErrors(DEFAULT_MATCH_FORMAT);

export function regularSetWinner(a, b, gamesPerSet = DEFAULT_MATCH_FORMAT.singles.gamesPerSet) {
  if (a === gamesPerSet && b >= 0 && b <= gamesPerSet - 1) return 1;
  if (b === gamesPerSet && a >= 0 && a <= gamesPerSet - 1) return 2;
  return null;
}

export function isValidTiebreakScore(winnerPoints, loserPoints, minPoints, winBy = 2) {
  return winnerPoints >= minPoints && winnerPoints - loserPoints >= winBy;
}

function validateRegularSet(set, label, errors, setFormat, errorMessages) {
  const a = Number(set.team1);
  const b = Number(set.team2);
  const gamesPerSet = setFormat.gamesPerSet;
  const winner = regularSetWinner(a, b, gamesPerSet);
  if (!winner) {
    errors.push(`${label}: ${errorMessages.regularSet}`);
    return null;
  }
  if (Math.max(a, b) === gamesPerSet && Math.min(a, b) === gamesPerSet - 1) {
    const tb = set.tieBreak;
    if (!tb || tb.team1 == null || tb.team2 == null) {
      errors.push(`${label}: ${errorMessages.tieRequired}`);
      return winner;
    }
    const tbWinner = Number(tb.team1) > Number(tb.team2) ? 1 : 2;
    const winnerPoints = Math.max(Number(tb.team1) || 0, Number(tb.team2) || 0);
    const loserPoints = Math.min(Number(tb.team1) || 0, Number(tb.team2) || 0);
    if (tbWinner !== winner || !isValidTiebreakScore(winnerPoints, loserPoints, setFormat.setTiebreak.minPoints, setFormat.setTiebreak.winBy)) {
      errors.push(`${label}: ${errorMessages.tieInvalid}`);
    }
  }
  return winner;
}

function validateMatchTieBreak(set, label, errors, matchTiebreakFormat, errorMessages) {
  const matchTieBreak = typeof set.matchTieBreak === 'object' ? set.matchTieBreak : null;
  const a = Number(matchTieBreak?.team1 ?? set.team1) || 0;
  const b = Number(matchTieBreak?.team2 ?? set.team2) || 0;
  const winner = a > b ? 1 : (b > a ? 2 : null);
  const winnerPoints = Math.max(a, b);
  const loserPoints = Math.min(a, b);
  if (!winner || !isValidTiebreakScore(winnerPoints, loserPoints, matchTiebreakFormat.minPoints, matchTiebreakFormat.winBy)) {
    errors.push(`${label}: ${errorMessages.matchTieInvalid}`);
  }
  return winner;
}

export function validateLineScore(line, format = DEFAULT_MATCH_FORMAT) {
  const errors = [];
  const sets = line?.sets || [];
  const type = line.type === 'singles' ? 'singles' : 'doubles';
  const typeFormat = format[type] || DEFAULT_MATCH_FORMAT[type];
  const errorMessages = buildScoreErrors(format);
  let s1 = 0, s2 = 0;
  sets.forEach((set, idx) => {
    const isDoublesMatchTieBreak = type === 'doubles' && idx === 2 && set.matchTieBreak;
    const winner = isDoublesMatchTieBreak
      ? validateMatchTieBreak(set, line.label, errors, typeFormat.matchTiebreak, errorMessages)
      : validateRegularSet(set, line.label, errors, typeFormat, errorMessages);
    if (winner === 1) s1 += 1;
    if (winner === 2) s2 += 1;
  });

  if (type === 'singles') {
    if (Math.max(s1, s2) !== typeFormat.setsToWin || Math.min(s1, s2) >= typeFormat.setsToWin) errors.push(`${line.label}: ${errorMessages.singlesSets}`);
  } else {
    const firstTwoSplit = sets.length >= 2 && regularSetWinner(Number(sets[0].team1), Number(sets[0].team2), typeFormat.gamesPerSet) !== regularSetWinner(Number(sets[1].team1), Number(sets[1].team2), typeFormat.gamesPerSet);
    if (firstTwoSplit) {
      if (!sets[2]?.matchTieBreak) errors.push(`${line.label}: ${errorMessages.doublesThird}`);
    } else if (sets[2]?.team1 != null || sets[2]?.team2 != null) {
      errors.push(`${line.label}: ${errorMessages.doublesThird}`);
    }
    if (Math.max(s1, s2) !== typeFormat.setsToWin || Math.min(s1, s2) >= typeFormat.setsToWin) errors.push(`${line.label}: ${errorMessages.doublesSets}`);
  }
  return [...new Set(errors)];
}
