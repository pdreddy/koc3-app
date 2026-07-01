import { roundRobin, buildScheduleFor8x2, buildScheduleFromGroups } from './roundRobin';

function mockTeam(n) {
  return { id: `team${n}`, abbreviation: `T${n}` };
}

describe('roundRobin', () => {
  test('produces n-1 rounds of n/2 pairings for n teams', () => {
    const rounds = roundRobin(8);
    expect(rounds).toHaveLength(7);
    rounds.forEach(round => expect(round).toHaveLength(4));
  });

  test('every team plays every other team exactly once', () => {
    const rounds = roundRobin(6);
    const seen = new Set();
    rounds.forEach(round => round.forEach(([i, j]) => {
      const key = [i, j].sort().join('-');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }));
    expect(seen.size).toBe((6 * 5) / 2);
  });
});

describe('buildScheduleFor8x2 — locked-in output (must stay byte-identical for KOC)', () => {
  test('matches the golden snapshot captured before the config-driven generalization', () => {
    const groupA = Array.from({ length: 8 }, (_, i) => mockTeam(i + 1));
    const groupB = Array.from({ length: 8 }, (_, i) => mockTeam(i + 9));
    const schedule = buildScheduleFor8x2(groupA, groupB);
    expect(schedule).toMatchSnapshot();
  });
});

describe('buildScheduleFromGroups — generalized N groups x M teams', () => {
  test('supports a single group of 4 teams', () => {
    const teams = Array.from({ length: 4 }, (_, i) => mockTeam(i + 1));
    const schedule = buildScheduleFromGroups([
      { label: 'A', teams, firstDate: new Date(2026, 0, 4), time: '6:00 PM' },
    ], { scheduleVersion: 'test-v1' });
    const matches = Object.values(schedule);
    expect(matches).toHaveLength(3 * 2); // 3 rounds x 2 matches/round
    matches.forEach(m => expect(m.scheduleVersion).toBe('test-v1'));
  });

  test('supports three groups of different sizes', () => {
    const teamsA = Array.from({ length: 4 }, (_, i) => mockTeam(i + 1));
    const teamsB = Array.from({ length: 6 }, (_, i) => mockTeam(i + 10));
    const teamsC = Array.from({ length: 8 }, (_, i) => mockTeam(i + 20));
    const schedule = buildScheduleFromGroups([
      { label: 'A', teams: teamsA, firstDate: new Date(2026, 0, 4), time: '6:00 PM' },
      { label: 'B', teams: teamsB, firstDate: new Date(2026, 0, 5), time: '6:00 PM' },
      { label: 'C', teams: teamsC, firstDate: new Date(2026, 0, 6), time: '6:00 PM' },
    ], { scheduleVersion: 'test-v2' });
    const byGroup = { A: 0, B: 0, C: 0 };
    Object.values(schedule).forEach(m => { byGroup[m.group] += 1; });
    expect(byGroup.A).toBe(3 * 2); // 4 teams: 3 rounds x 2 matches
    expect(byGroup.B).toBe(5 * 3); // 6 teams: 5 rounds x 3 matches
    expect(byGroup.C).toBe(7 * 4); // 8 teams: 7 rounds x 4 matches
  });
});
