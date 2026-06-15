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

/**
 * Build an initial schedule for two groups on weekly Sundays starting at `startDate`.
 * @param {Array} groupATeams - 8 teams with .id and .abbreviation
 * @param {Array} groupBTeams - 8 teams with .id and .abbreviation
 * @param {Date} startDate - first Sunday
 * @returns {Object} map of matchId -> match record (Firebase-friendly)
 */
export function buildScheduleFor8x2(groupATeams, groupBTeams, startDate) {
  const out = {};
  const pairingsA = roundRobin(8);
  const pairingsB = roundRobin(8);

  for (let r = 0; r < 7; r++) {
    const sunday = new Date(startDate.getTime());
    sunday.setDate(startDate.getDate() + r * 7);
    const dateISO = sunday.toISOString().slice(0, 10); // YYYY-MM-DD

    const buildGroup = (label, teamsArr, pairings) => {
      pairings[r].forEach(([i, j], k) => {
        const t1 = teamsArr[i];
        const t2 = teamsArr[j];
        if (!t1 || !t2) return;
        const slot = ['9:00 AM', '10:30 AM', '12:00 PM', '1:30 PM'][k] || '5:00 PM';
        const id = `${label}-r${r + 1}-m${k + 1}`;
        out[id] = {
          id,
          group: label,
          round: r + 1,
          date: dateISO,
          time: slot,
          team1Id: t1.id,
          team2Id: t2.id,
          status: 'scheduled'
        };
      });
    };

    buildGroup('A', groupATeams, pairingsA);
    buildGroup('B', groupBTeams, pairingsB);
  }
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
