// Config-driven standings tiebreak comparator. Extracted from the sort chain that
// previously lived inline in pages/Standings.js so the tiebreak order can be sourced
// from LeagueConfig — DEFAULT_TIEBREAK_ORDER reproduces that original chain exactly,
// so callers that don't pass a custom order see byte-identical ordering to before.
export const DEFAULT_TIEBREAK_ORDER = [
  'points', 'setsFor', 'gamesFor', 'singlesWins', 'headToHead', 'setDiff', 'gameDiff', 'teamName'
];

const TIEBREAK_COMPARATORS = {
  points:      (a, b) => b.points - a.points,
  setsFor:     (a, b) => b.setsFor - a.setsFor,
  gamesFor:    (a, b) => b.gamesFor - a.gamesFor,
  singlesWins: (a, b) => b.singlesWins - a.singlesWins,
  headToHead:  (a, b, headToHead) => (headToHead[`${b.id}:${a.id}`] || 0) - (headToHead[`${a.id}:${b.id}`] || 0),
  setDiff:     (a, b) => b.setDiff - a.setDiff,
  gameDiff:    (a, b) => b.gameDiff - a.gameDiff,
  teamName:    (a, b) => a.team.localeCompare(b.team),
};

export function buildStandingsComparator(tiebreakOrder, headToHead = {}) {
  const order = Array.isArray(tiebreakOrder) && tiebreakOrder.length > 0 ? tiebreakOrder : DEFAULT_TIEBREAK_ORDER;
  const handlers = order.map(key => TIEBREAK_COMPARATORS[key]).filter(Boolean);
  return (a, b) => {
    for (const handler of handlers) {
      const result = handler(a, b, headToHead);
      if (result) return result;
    }
    return 0;
  };
}
