// Round-robin pairings using the circle method.
// Returns an array of `rounds`, each round is an array of [teamAIndex, teamBIndex] pairs.
export function roundRobin(n) {
  if (n < 2 || n % 2 !== 0) throw new Error('Need an even number of teams');
  const teams = Array.from({ length: n }, (_, i) => i);
  const rounds = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    const arr = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      round.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(round);
    // rotate: take last and insert at start of rotating
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

export const KOC3_SCHEDULE_VERSION = 'koc3-2026-06-27-group-weekends-715pm-v2';

const GROUP_A_FIRST_DATE = new Date(2026, 5, 27); // Jun 27, 2026
const GROUP_B_FIRST_DATE = new Date(2026, 5, 28); // Jun 28, 2026
const BUFFER_WEEK_START = new Date(2026, 6, 4); // Jul 4, 2026

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateForRound(firstDate, roundIndex, bufferAfterRoundIndex) {
  const date = new Date(firstDate.getTime());
  const extraWeek = (bufferAfterRoundIndex != null && roundIndex > bufferAfterRoundIndex) ? 1 : 0;
  const weekOffset = roundIndex + extraWeek;
  date.setDate(firstDate.getDate() + weekOffset * 7);
  return date;
}

/**
 * Config-driven round-robin schedule builder for N groups of arbitrary size.
 * @param {Array<{label: string, teams: Array, firstDate: Date, time: string, roundsPerGroup?: number}>} groups
 * @param {{ bufferAfterRoundIndex?: number, scheduleVersion?: string }} [options] - bufferAfterRoundIndex
 *   inserts one extra week's gap immediately after that 0-based round index (KOC's Jul 4 buffer weekend).
 * @returns {Object} map of matchId -> match record (Firebase-friendly)
 */
export function buildScheduleFromGroups(groups, { bufferAfterRoundIndex = null, scheduleVersion } = {}) {
  const out = {};
  groups.forEach(({ label, teams, firstDate, time, roundsPerGroup }) => {
    const teamCount = teams.length;
    const pairings = roundRobin(teamCount);
    const rounds = roundsPerGroup ?? (teamCount - 1);
    for (let r = 0; r < rounds; r++) {
      const dateISO = isoDate(dateForRound(firstDate, r, bufferAfterRoundIndex));
      pairings[r].forEach(([i, j], k) => {
        const t1 = teams[i];
        const t2 = teams[j];
        if (!t1 || !t2) return;
        const id = `${label}-r${r + 1}-m${k + 1}`;
        out[id] = {
          id,
          group: label,
          round: r + 1,
          date: dateISO,
          time,
          team1Id: t1.id,
          team2Id: t2.id,
          status: 'scheduled',
          scheduleVersion
        };
      });
    }
  });
  return out;
}

/**
 * Build the KOC3 schedule for two 8-team groups.
 * Group A plays Saturdays starting Jun 27, 2026; Group B plays Sundays starting Jun 28, 2026.
 * Jul 4/5 is a buffer weekend, then the remaining six weekly rounds continue.
 * @param {Array} groupATeams - 8 teams with .id and .abbreviation in requested seed order
 * @param {Array} groupBTeams - 8 teams with .id and .abbreviation in requested seed order
 * @returns {Object} map of matchId -> match record (Firebase-friendly)
 */
export function buildScheduleFor8x2(groupATeams, groupBTeams) {
  const out = buildScheduleFromGroups([
    { label: 'A', teams: groupATeams, firstDate: GROUP_A_FIRST_DATE, time: '7:15 PM', roundsPerGroup: 7 },
    { label: 'B', teams: groupBTeams, firstDate: GROUP_B_FIRST_DATE, time: '7:15 PM', roundsPerGroup: 7 },
  ], { bufferAfterRoundIndex: 0, scheduleVersion: KOC3_SCHEDULE_VERSION });

  out.buffer_week = {
    id: 'buffer_week',
    type: 'buffer',
    round: 2,
    group: 'ALL',
    date: isoDate(BUFFER_WEEK_START),
    time: '',
    title: 'July 4 buffer week',
    status: 'buffer',
    scheduleVersion: KOC3_SCHEDULE_VERSION
  };

  return out;
}

// First Sunday on or after the given date
export function firstSundayOnOrAfter(d) {
  const out = new Date(d.getTime());
  while (out.getDay() !== 0) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}
