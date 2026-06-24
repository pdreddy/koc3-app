// Config-driven tennis score validation.
//
// Historically these rules were hardcoded to the KOC3 format (first-to-4-game
// mini-sets, singles best-of-5, doubles best-of-3 with a 10-point match
// tiebreak as the deciding set). They are now parameterized by a per-discipline
// "match rules" object so a club can configure set length, sets-to-win,
// tiebreak points and final-set behavior per game type — and validation checks
// scores against that configuration. When no rules are supplied, the defaults
// below reproduce the original KOC3 behavior exactly, so existing callers and
// stored scores are unaffected.

export const DEFAULT_MATCH_RULES = {
  singles: { setGames: 4, setsToWin: 3, setTiebreakPoints: 7, finalSetMatchTiebreak: false, matchTiebreakPoints: 10, noAd: false },
  doubles: { setGames: 4, setsToWin: 2, setTiebreakPoints: 7, finalSetMatchTiebreak: true, matchTiebreakPoints: 10, noAd: false }
};

export function resolveMatchRules(type, override) {
  const base = DEFAULT_MATCH_RULES[type === 'singles' ? 'singles' : 'doubles'];
  const merged = { ...base, ...(override || {}) };
  // Guard against bad config values.
  merged.setGames = Number(merged.setGames) > 0 ? Math.floor(Number(merged.setGames)) : base.setGames;
  merged.setsToWin = Number(merged.setsToWin) > 0 ? Math.floor(Number(merged.setsToWin)) : base.setsToWin;
  merged.setTiebreakPoints = Number(merged.setTiebreakPoints) > 0 ? Math.floor(Number(merged.setTiebreakPoints)) : base.setTiebreakPoints;
  merged.matchTiebreakPoints = Number(merged.matchTiebreakPoints) > 0 ? Math.floor(Number(merged.matchTiebreakPoints)) : base.matchTiebreakPoints;
  return merged;
}

// Index (0-based) of the deciding set, e.g. best-of-3 → 2, best-of-5 → 4.
function decidingSetIndex(rules) {
  return rules.setsToWin * 2 - 2;
}

export const SCORE_ERRORS = {
  regularSet: 'Only N-0 … N-(N-1) are valid set scores.',
  tieRequired: 'A deciding-game set requires a tiebreak score.',
  tieInvalid: 'Tiebreak winner must reach the configured points and win by 2.',
  matchTieInvalid: 'Match tiebreak winner must reach the configured points and win by 2.',
  setsToWin: 'Winner must win the required number of sets.',
  finalSetTiebreak: 'The deciding set must be a match tiebreak.'
};

export function regularSetWinner(a, b, setGames = 4) {
  if (a === setGames && b >= 0 && b <= setGames - 1) return 1;
  if (b === setGames && a >= 0 && a <= setGames - 1) return 2;
  return null;
}

export function isValidTiebreakScore(winnerPoints, loserPoints, minPoints) {
  return winnerPoints >= minPoints && winnerPoints - loserPoints >= 2;
}

function validateRegularSet(set, label, errors, rules) {
  const a = Number(set.team1);
  const b = Number(set.team2);
  const winner = regularSetWinner(a, b, rules.setGames);
  if (!winner) {
    errors.push(`${label}: Only valid set scores up to ${rules.setGames} games are allowed (e.g. ${rules.setGames}-0 … ${rules.setGames}-${rules.setGames - 1}).`);
    return null;
  }
  // A set that finishes setGames-vs-(setGames-1) is decided by a tiebreak.
  if (Math.max(a, b) === rules.setGames && Math.min(a, b) === rules.setGames - 1) {
    const tb = set.tieBreak;
    if (!tb || tb.team1 == null || tb.team2 == null) {
      errors.push(`${label}: a ${rules.setGames}-${rules.setGames - 1} set requires a tiebreak score.`);
      return winner;
    }
    const tbWinner = Number(tb.team1) > Number(tb.team2) ? 1 : 2;
    const winnerPoints = Math.max(Number(tb.team1) || 0, Number(tb.team2) || 0);
    const loserPoints = Math.min(Number(tb.team1) || 0, Number(tb.team2) || 0);
    if (tbWinner !== winner || !isValidTiebreakScore(winnerPoints, loserPoints, rules.setTiebreakPoints)) {
      errors.push(`${label}: tiebreak winner must reach ${rules.setTiebreakPoints} and win by 2.`);
    }
  }
  return winner;
}

function validateMatchTieBreak(set, label, errors, rules) {
  const a = Number(set.team1) || 0;
  const b = Number(set.team2) || 0;
  const winner = a > b ? 1 : (b > a ? 2 : null);
  const winnerPoints = Math.max(a, b);
  const loserPoints = Math.min(a, b);
  if (!winner || !isValidTiebreakScore(winnerPoints, loserPoints, rules.matchTiebreakPoints)) {
    errors.push(`${label}: match tiebreak winner must reach ${rules.matchTiebreakPoints} and win by 2.`);
  }
  return winner;
}

// Validate a single line's set scores against the resolved (or default) rules.
export function validateLineScore(line, rulesOverride) {
  const rules = resolveMatchRules(line?.type, rulesOverride);
  const errors = [];
  const sets = line?.sets || [];
  const decideIdx = decidingSetIndex(rules);
  let s1 = 0, s2 = 0;

  sets.forEach((set, idx) => {
    const isMatchTieBreak = rules.finalSetMatchTiebreak && idx === decideIdx && set.matchTieBreak;
    const winner = isMatchTieBreak
      ? validateMatchTieBreak(set, line.label, errors, rules)
      : validateRegularSet(set, line.label, errors, rules);
    if (winner === 1) s1 += 1;
    if (winner === 2) s2 += 1;
  });

  // Final-set match-tiebreak structure check (e.g. doubles best-of-3 → 3rd set
  // must be a match tiebreak when the regular sets are split).
  if (rules.finalSetMatchTiebreak) {
    const regularSets = sets.slice(0, decideIdx);
    let r1 = 0, r2 = 0;
    regularSets.forEach(set => {
      const w = regularSetWinner(Number(set.team1), Number(set.team2), rules.setGames);
      if (w === 1) r1 += 1; if (w === 2) r2 += 1;
    });
    const reachedDecider = r1 === rules.setsToWin - 1 && r2 === rules.setsToWin - 1 && regularSets.length >= decideIdx;
    if (reachedDecider) {
      if (!sets[decideIdx]?.matchTieBreak) errors.push(`${line.label}: ${SCORE_ERRORS.finalSetTiebreak}`);
    } else if (sets[decideIdx]?.team1 != null || sets[decideIdx]?.team2 != null) {
      errors.push(`${line.label}: ${SCORE_ERRORS.finalSetTiebreak}`);
    }
  }

  if (Math.max(s1, s2) !== rules.setsToWin || Math.min(s1, s2) >= rules.setsToWin) {
    errors.push(`${line.label}: ${line.type === 'singles' ? 'Singles' : 'Doubles'} winner must win ${rules.setsToWin} set${rules.setsToWin === 1 ? '' : 's'}.`);
  }
  return [...new Set(errors)];
}
