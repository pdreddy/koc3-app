import { buildStandingsComparator, DEFAULT_TIEBREAK_ORDER } from './standingsRanking';

// Reference implementation: the exact inline sort comparator that used to live in
// pages/Standings.js, kept here only to prove the extracted, config-driven comparator
// (with default order) produces byte-identical ordering.
function referenceComparator(headToHead) {
  return (a, b) =>
    (b.points - a.points) ||
    (b.setsFor - a.setsFor) ||
    (b.gamesFor - a.gamesFor) ||
    (b.singlesWins - a.singlesWins) ||
    ((headToHead[`${b.id}:${a.id}`] || 0) - (headToHead[`${a.id}:${b.id}`] || 0)) ||
    (b.setDiff - a.setDiff) ||
    (b.gameDiff - a.gameDiff) ||
    a.team.localeCompare(b.team);
}

function randomRow(id) {
  return {
    id,
    team: `Team ${id}`,
    points: Math.floor(Math.random() * 5),
    setsFor: Math.floor(Math.random() * 10),
    gamesFor: Math.floor(Math.random() * 40),
    singlesWins: Math.floor(Math.random() * 3),
    setDiff: Math.floor(Math.random() * 10) - 5,
    gameDiff: Math.floor(Math.random() * 20) - 10,
  };
}

describe('buildStandingsComparator', () => {
  test('default order matches the exact chain previously inlined in Standings.js', () => {
    const headToHead = { 't1:t2': 1, 't2:t1': 0 };
    const rows = [randomRow('t1'), randomRow('t2'), randomRow('t3'), randomRow('t4'), randomRow('t5')];

    for (let trial = 0; trial < 200; trial++) {
      const shuffled = [...rows].sort(() => Math.random() - 0.5);
      const viaUtil = [...shuffled].sort(buildStandingsComparator(DEFAULT_TIEBREAK_ORDER, headToHead));
      const viaReference = [...shuffled].sort(referenceComparator(headToHead));
      expect(viaUtil.map(r => r.id)).toEqual(viaReference.map(r => r.id));
    }
  });

  test('falls back to DEFAULT_TIEBREAK_ORDER when no order is provided', () => {
    const headToHead = {};
    const rows = [
      { id: 't1', team: 'Alpha', points: 1, setsFor: 2, gamesFor: 12, singlesWins: 0, setDiff: 2, gameDiff: 7 },
      { id: 't2', team: 'Beta', points: 0, setsFor: 0, gamesFor: 5, singlesWins: 0, setDiff: -2, gameDiff: -7 },
    ];
    const sorted = [...rows].sort(buildStandingsComparator(undefined, headToHead));
    expect(sorted[0].id).toBe('t1');
  });

  test('unknown tiebreak keys are ignored rather than throwing', () => {
    const rows = [
      { id: 't1', team: 'Alpha', points: 1 },
      { id: 't2', team: 'Beta', points: 2 },
    ];
    const comparator = buildStandingsComparator(['unknownKey', 'points'], {});
    const sorted = [...rows].sort(comparator);
    expect(sorted[0].id).toBe('t2');
  });
});
