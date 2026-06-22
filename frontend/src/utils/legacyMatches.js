import { matchTeamNames } from './matchTeams';

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLine(line = {}, index = 0) {
  const sets = Array.isArray(line.sets) ? line.sets : [];
  const setTotals = sets.reduce((acc, set) => {
    const t1 = numberOrZero(set.team1 ?? set.t1 ?? set.p1);
    const t2 = numberOrZero(set.team2 ?? set.t2 ?? set.p2);
    if (t1 > t2) acc.s1 += 1;
    else if (t2 > t1) acc.s2 += 1;
    acc.g1 += t1;
    acc.g2 += t2;
    return acc;
  }, { g1: 0, g2: 0, s1: 0, s2: 0 });
  const g1 = numberOrZero(line.g1 ?? line.games1 ?? line.team1Games) || setTotals.g1;
  const g2 = numberOrZero(line.g2 ?? line.games2 ?? line.team2Games) || setTotals.g2;
  const s1 = numberOrZero(line.s1 ?? line.sets1 ?? line.team1Sets) || setTotals.s1;
  const s2 = numberOrZero(line.s2 ?? line.sets2 ?? line.team2Sets) || setTotals.s2;
  return {
    ...line,
    label: line.label || (index === 0 ? 'Singles' : index === 1 ? 'Doubles' : 'Reverse Doubles'),
    type: line.type || (index === 0 ? 'singles' : 'doubles'),
    players: {
      team1: Array.isArray(line.players?.team1) ? line.players.team1.filter(Boolean) : [],
      team2: Array.isArray(line.players?.team2) ? line.players.team2.filter(Boolean) : []
    },
    sets,
    g1,
    g2,
    s1,
    s2
  };
}

export function normalizeMatchRecord(match = {}, teams = {}) {
  const lines = Array.isArray(match.lines) ? match.lines.map(normalizeLine) : [];
  const totals = lines.reduce((acc, line) => {
    acc.g1 += numberOrZero(line.g1);
    acc.g2 += numberOrZero(line.g2);
    acc.s1 += numberOrZero(line.s1);
    acc.s2 += numberOrZero(line.s2);
    return acc;
  }, { g1: 0, g2: 0, s1: 0, s2: 0 });
  const names = matchTeamNames(match, teams);
  const g1 = numberOrZero(match.g1 ?? match.games1) || totals.g1;
  const g2 = numberOrZero(match.g2 ?? match.games2) || totals.g2;
  const s1 = numberOrZero(match.s1 ?? match.sets1) || totals.s1;
  const s2 = numberOrZero(match.s2 ?? match.sets2) || totals.s2;
  const win = match.win || match.winner || (g1 > g2 ? names.t1Name : g2 > g1 ? names.t2Name : '');
  return {
    ...match,
    t1: names.t1Name,
    t2: names.t2Name,
    t1Id: names.team1Id || match.t1Id || '',
    t2Id: names.team2Id || match.t2Id || '',
    t1Abbr: names.t1Abbr,
    t2Abbr: names.t2Abbr,
    g1,
    g2,
    s1,
    s2,
    win,
    lines
  };
}

export function cleanMatchList(matches = [], teams = {}) {
  const seen = new Set();
  return matches
    .map(match => normalizeMatchRecord(match, teams))
    .filter(match => match.t1 && match.t2 && match.t1 !== 'Unknown' && match.t2 !== 'Unknown')
    .filter(match => {
      const key = [match.source || '', match.id || '', match.ts || '', match.t1, match.t2, match.g1, match.g2].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
