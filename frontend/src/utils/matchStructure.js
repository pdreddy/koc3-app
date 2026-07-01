// Config-driven match-day line structure: how many singles lines, how many doubles pairs
// per team, and the resulting "cross-pairing" round robin between them (KOC's format: each
// team's 2 doubles pairs each play both of the opposing team's pairs — the second meeting
// per pair is the "Reverse" line). DEFAULT_MATCH_STRUCTURE reproduces KOC's exact current
// 5-line format (1 singles + 4 doubles) — see pages/ScoreEntry.js, which this generalizes.
//
// Scope note: this covers the *scoring* side (utils/matchStructure.js, ScoreEntry.js's court
// list). The pre-match *lineup submission* UI (pages/Home.js buildDashboardLineupLines) and
// the lineup-lock Cloud Function (functions/index.js) still hardcode the S1/D1/D2 shape —
// generalizing those needs a real Firebase deploy to verify and is tracked separately in
// memory/MULTI_CLUB_SAAS_PLAN.md. Because DEFAULT_MATCH_STRUCTURE reproduces that same
// S1/D1/D2, 5-slot shape, the two stay compatible as long as a club uses the default.
export const DEFAULT_MATCH_STRUCTURE = {
  singlesLines: 1,
  doublesPairsPerTeam: 2,
  singlesSetCount: 5,
  doublesSetCount: 3,
};

function doublesLabel(pairIndex, opponentPairIndex, doublesPairsPerTeam) {
  if (pairIndex === opponentPairIndex) return `Doubles ${pairIndex + 1}`;
  if (doublesPairsPerTeam === 2) return `Doubles ${pairIndex + 1} Reverse`;
  return `Doubles ${pairIndex + 1} vs Pair ${opponentPairIndex + 1}`;
}

// Ordered list of scoring lines: singles line(s) first, then each team-pair's matchups
// against every opposing pair, own-index (direct) matchup first. For the default 2-pair
// case this produces exactly: Singles, Doubles 1, Doubles 1 Reverse, Doubles 2, Doubles 2 Reverse.
export function buildCourtTemplates(structure = DEFAULT_MATCH_STRUCTURE) {
  const { singlesLines, doublesPairsPerTeam, singlesSetCount, doublesSetCount } = structure;
  const templates = [];
  for (let s = 0; s < singlesLines; s++) {
    templates.push({
      label: singlesLines > 1 ? `Singles ${s + 1}` : 'Singles',
      type: 'singles',
      setCount: singlesSetCount,
      pair1: null,
      pair2: null,
    });
  }
  for (let a = 0; a < doublesPairsPerTeam; a++) {
    for (let i = 0; i < doublesPairsPerTeam; i++) {
      const b = (a + i) % doublesPairsPerTeam;
      templates.push({
        label: doublesLabel(a, b, doublesPairsPerTeam),
        type: 'doubles',
        setCount: doublesSetCount,
        pair1: a,
        pair2: b,
      });
    }
  }
  return templates;
}

// Maps a flat list of player names per team (singles player(s) first, then each doubles
// pair's two members in order) onto the court templates above.
export function buildCourtsFromNames(team1Names, team2Names, structure = DEFAULT_MATCH_STRUCTURE) {
  const templates = buildCourtTemplates(structure);
  const totalNamesNeeded = structure.singlesLines + structure.doublesPairsPerTeam * 2;
  if ((team1Names?.length || 0) < totalNamesNeeded || (team2Names?.length || 0) < totalNamesNeeded) {
    return templates;
  }

  const pairsFrom = (names) => Array.from({ length: structure.doublesPairsPerTeam }, (_, a) => {
    const start = structure.singlesLines + a * 2;
    return [names[start], names[start + 1]];
  });
  const pairs1 = pairsFrom(team1Names);
  const pairs2 = pairsFrom(team2Names);

  let singlesIdx = 0;
  return templates.map(court => {
    if (court.type === 'singles') {
      const idx = singlesIdx++;
      return { ...court, p1: [team1Names[idx]], p2: [team2Names[idx]] };
    }
    return { ...court, p1: pairs1[court.pair1], p2: pairs2[court.pair2] };
  });
}

// The pre-match lineup-submission picker slots (1 per player the captain must select).
export function buildLineupRoleSlots(structure = DEFAULT_MATCH_STRUCTURE) {
  const slots = [];
  for (let s = 0; s < structure.singlesLines; s++) {
    slots.push({
      code: structure.singlesLines > 1 ? `S${s + 1}` : 'S',
      label: structure.singlesLines > 1 ? `Singles ${s + 1}` : 'Singles',
    });
  }
  for (let a = 0; a < structure.doublesPairsPerTeam; a++) {
    const code = `D${a + 1}`;
    slots.push({ code, label: `Doubles ${a + 1} player A` });
    slots.push({ code, label: `Doubles ${a + 1} player B` });
  }
  return slots;
}
