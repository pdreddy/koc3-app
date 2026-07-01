import { buildCourtTemplates, buildCourtsFromNames, buildLineupRoleSlots, DEFAULT_MATCH_STRUCTURE } from './matchStructure';

describe('buildCourtTemplates — default (KOC) structure', () => {
  test('produces the exact 5-line order/labels hardcoded in the original COURT_TEMPLATES', () => {
    const templates = buildCourtTemplates();
    expect(templates.map(t => t.label)).toEqual(['Singles', 'Doubles 1', 'Doubles 1 Reverse', 'Doubles 2', 'Doubles 2 Reverse']);
    expect(templates.map(t => t.type)).toEqual(['singles', 'doubles', 'doubles', 'doubles', 'doubles']);
    expect(templates.map(t => t.setCount)).toEqual([5, 3, 3, 3, 3]);
  });
});

describe('buildCourtsFromNames — default (KOC) structure', () => {
  // Ported verbatim from the original pages/ScoreEntry.test.js buildLineupCourts assertions,
  // which can't run here because ScoreEntry.js transitively imports firebase.js (import.meta.env,
  // a pre-existing, unrelated Jest/Vite incompatibility) — this proves the extracted engine
  // reproduces the exact same mapping that test locked in.
  test('maps official revealed lineup into score-entry court order', () => {
    const courts = buildCourtsFromNames(
      ['RR Singles', 'RR D1 A', 'RR D1 B', 'RR D2 A', 'RR D2 B'],
      ['BB Singles', 'BB D1 A', 'BB D1 B', 'BB D2 A', 'BB D2 B']
    );

    expect(courts.map(court => court.label)).toEqual(['Singles', 'Doubles 1', 'Doubles 1 Reverse', 'Doubles 2', 'Doubles 2 Reverse']);
    expect(courts[0].p1).toEqual(['RR Singles']);
    expect(courts[0].p2).toEqual(['BB Singles']);
    expect(courts[1].p1).toEqual(['RR D1 A', 'RR D1 B']);
    expect(courts[1].p2).toEqual(['BB D1 A', 'BB D1 B']);
    expect(courts[2].p1).toEqual(['RR D1 A', 'RR D1 B']);
    expect(courts[2].p2).toEqual(['BB D2 A', 'BB D2 B']);
    expect(courts[3].p1).toEqual(['RR D2 A', 'RR D2 B']);
    expect(courts[3].p2).toEqual(['BB D2 A', 'BB D2 B']);
    expect(courts[4].p1).toEqual(['RR D2 A', 'RR D2 B']);
    expect(courts[4].p2).toEqual(['BB D1 A', 'BB D1 B']);
  });

  test('returns bare templates (no p1/p2) when fewer than 5 names are given per team', () => {
    const courts = buildCourtsFromNames(['Only One'], ['Only One']);
    expect(courts[0].p1).toBeUndefined();
  });
});

describe('buildLineupRoleSlots — default (KOC) structure', () => {
  test('matches the exact 5 slots hardcoded in the original LINEUP_ROLE_SLOTS', () => {
    expect(buildLineupRoleSlots()).toEqual([
      { code: 'S', label: 'Singles' },
      { code: 'D1', label: 'Doubles 1 player A' },
      { code: 'D1', label: 'Doubles 1 player B' },
      { code: 'D2', label: 'Doubles 2 player A' },
      { code: 'D2', label: 'Doubles 2 player B' },
    ]);
  });
});

describe('generalized match structure (not used by KOC today, proves real configurability)', () => {
  test('supports a single doubles pair (1 singles + 1 direct doubles matchup)', () => {
    const structure = { singlesLines: 1, doublesPairsPerTeam: 1, singlesSetCount: 3, doublesSetCount: 3 };
    const templates = buildCourtTemplates(structure);
    expect(templates.map(t => t.label)).toEqual(['Singles', 'Doubles 1']);
  });

  test('supports 3 doubles pairs per team with unique, unambiguous labels', () => {
    const structure = { singlesLines: 1, doublesPairsPerTeam: 3, singlesSetCount: 5, doublesSetCount: 3 };
    const templates = buildCourtTemplates(structure);
    const doublesLabels = templates.filter(t => t.type === 'doubles').map(t => t.label);
    expect(doublesLabels).toHaveLength(9); // 3 pairs x 3 opponents each
    expect(new Set(doublesLabels).size).toBe(9); // all unique
  });

  test('supports 2 singles lines', () => {
    const structure = { ...DEFAULT_MATCH_STRUCTURE, singlesLines: 2 };
    const templates = buildCourtTemplates(structure);
    expect(templates.filter(t => t.type === 'singles').map(t => t.label)).toEqual(['Singles 1', 'Singles 2']);
    const slots = buildLineupRoleSlots(structure);
    expect(slots.filter(s => s.code.startsWith('S')).map(s => s.code)).toEqual(['S1', 'S2']);
  });
});
