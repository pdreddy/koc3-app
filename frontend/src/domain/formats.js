// Event format strategies behind a common interface, so new formats plug in
// without touching the rest of the app. Each strategy conforms to:
//
//   {
//     id, label,
//     supportsGroups: boolean,
//     generateSchedule(teams, options) -> fixtures (Firebase-friendly map) | null,
//     describe(config) -> string
//   }
//
// `round_robin` / `groups_playoffs` are functional today (they wrap the existing
// schedule generator). Knockout, ladder and Swiss are documented stubs that
// return null from generateSchedule until implemented — the seam exists so the
// UI and config already understand them.

import { buildScheduleFor8x2, roundRobin } from '../utils/roundRobin';
import { sortByGroupOrder } from '../data/auctionTeams';

function groupTeams(teams, groupId) {
  return Object.values(teams || {})
    .filter(t => (t.group || 'A') === groupId)
    .sort(sortByGroupOrder);
}

// Generic single round-robin fixture map for an arbitrary set of teams.
function genericRoundRobin(teamList, { startDate, label = 'R' } = {}) {
  const n = teamList.length;
  if (n < 2) return {};
  const even = n % 2 === 0 ? teamList : [...teamList, null]; // bye
  const rounds = roundRobin(even.length);
  const out = {};
  const base = startDate ? new Date(startDate) : new Date();
  rounds.forEach((round, r) => {
    const date = new Date(base.getTime());
    date.setDate(base.getDate() + r * 7);
    round.forEach(([i, j], k) => {
      const t1 = even[i];
      const t2 = even[j];
      if (!t1 || !t2) return; // bye
      const mId = `${label}-r${r + 1}-m${k + 1}`;
      out[mId] = {
        id: mId, round: r + 1, date: date.toISOString().slice(0, 10),
        time: '', team1Id: t1.id, team2Id: t2.id, status: 'scheduled', type: 'match'
      };
    });
  });
  return out;
}

export const leagueStrategy = {
  id: 'round_robin',
  label: 'Round-robin',
  supportsGroups: false,
  generateSchedule(teams, { config } = {}) {
    return genericRoundRobin(Object.values(teams || {}), { label: 'RR' });
  },
  describe() { return 'Every team plays every other team once.'; }
};

export const groupsPlayoffsStrategy = {
  id: 'groups_playoffs',
  label: 'Groups + playoffs',
  supportsGroups: true,
  generateSchedule(teams, { config } = {}) {
    const groups = config?.format?.groups || [{ id: 'A' }, { id: 'B' }];
    // Preserve the exact existing KOC3 behavior for the canonical 2×8 setup.
    if (groups.length === 2) {
      const a = groupTeams(teams, groups[0].id);
      const b = groupTeams(teams, groups[1].id);
      if (a.length === 8 && b.length === 8) return buildScheduleFor8x2(a, b);
    }
    // General case: a round-robin within each group.
    const out = {};
    groups.forEach(g => {
      const list = groupTeams(teams, g.id);
      Object.assign(out, genericRoundRobin(list, { label: `G${g.id}` }));
    });
    return out;
  },
  describe(config) {
    const n = config?.format?.groups?.length || 2;
    const q = config?.playoffs?.qualifyPerGroup || 2;
    return `${n} groups; top ${q} per group advance to a playoff bracket.`;
  }
};

function stub(id, label, describe) {
  return { id, label, supportsGroups: false, generateSchedule() { return null; }, describe: () => describe };
}

export const knockoutStrategy = stub('knockout', 'Knockout', 'Single-elimination bracket. (Scaffolded — generator coming soon.)');
export const ladderStrategy = stub('ladder', 'Ladder / Flex', 'Challenge-based ladder ranking. (Scaffolded — generator coming soon.)');
export const swissStrategy = stub('swiss', 'Swiss', 'Swiss pairing across fixed rounds. (Scaffolded — generator coming soon.)');

const REGISTRY = {
  round_robin: leagueStrategy,
  groups_playoffs: groupsPlayoffsStrategy,
  knockout: knockoutStrategy,
  ladder: ladderStrategy,
  swiss: swissStrategy
};

export function getFormatStrategy(formatType) {
  return REGISTRY[formatType] || groupsPlayoffsStrategy;
}

export function listFormatStrategies() {
  return Object.values(REGISTRY);
}
