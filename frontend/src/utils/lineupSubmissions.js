export const LINEUP_SLOTS = [
  { key: 'singles', label: 'Singles', count: 1, type: 'singles' },
  { key: 'doubles1', label: 'Doubles 1', count: 2, type: 'doubles' },
  { key: 'doubles2', label: 'Doubles 2', count: 2, type: 'doubles' },
  { key: 'reverseDoubles', label: 'Reverse Doubles', count: 2, type: 'doubles' },
  { key: 'reverseSingles', label: 'Reverse Singles', count: 1, type: 'singles' }
];

export function emptyLineup() {
  return LINEUP_SLOTS.reduce((acc, slot) => ({ ...acc, [slot.key]: Array(slot.count).fill('') }), {});
}

export function flattenLineup(lineup) {
  return LINEUP_SLOTS.flatMap(slot => lineup?.[slot.key] || []).filter(Boolean);
}

export function lineupStorageKey(matchScheduleId, teamId) {
  return `koc3-lineup:${matchScheduleId}:${teamId}`;
}

export function readStoredLineup(matchScheduleId, teamId) {
  if (!matchScheduleId || !teamId || typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(lineupStorageKey(matchScheduleId, teamId)) || 'null');
  } catch (err) {
    return null;
  }
}

export function writeStoredLineup(matchScheduleId, teamId, value) {
  localStorage.setItem(lineupStorageKey(matchScheduleId, teamId), JSON.stringify(value));
}

export function getRevealedLineupSubmission(matchScheduleId, team1Id, team2Id) {
  const team1Submission = readStoredLineup(matchScheduleId, team1Id);
  const team2Submission = readStoredLineup(matchScheduleId, team2Id);
  if (!team1Submission?.lockedAt || !team2Submission?.lockedAt) return null;
  return {
    matchScheduleId,
    revealedAt: team1Submission.revealedAt || team2Submission.revealedAt || new Date(Math.max(new Date(team1Submission.lockedAt).getTime(), new Date(team2Submission.lockedAt).getTime())).toISOString(),
    submissions: {
      [team1Id]: team1Submission,
      [team2Id]: team2Submission
    }
  };
}

export function getRevealedLineupMatches(schedule = {}, teams = {}) {
  return Object.values(schedule || {})
    .filter(item => item?.id && item?.team1Id && item?.team2Id && item?.type !== 'buffer')
    .map(item => ({ item, team1: teams[item.team1Id], team2: teams[item.team2Id], reveal: getRevealedLineupSubmission(item.id, item.team1Id, item.team2Id) }))
    .filter(row => row.team1 && row.team2 && row.reveal);
}

export function lineupToScoreCourts(team1Lineup, team2Lineup, newCourt) {
  return LINEUP_SLOTS.map(slot => {
    const court = newCourt(slot.label, slot.type, slot.type === 'singles' ? 5 : 3);
    return {
      ...court,
      p1: [...(team1Lineup?.[slot.key] || [])],
      p2: [...(team2Lineup?.[slot.key] || [])]
    };
  });
}

export function lineupToQuickScoreText(team1, team2, team1Lineup, team2Lineup) {
  const prefixes = { singles: 'S1', doubles1: 'D1', doubles2: 'D2', reverseDoubles: 'D3', reverseSingles: 'S2' };
  const lines = LINEUP_SLOTS.map(slot => {
    const prefix = prefixes[slot.key] || slot.label;
    return `${prefix}: ${(team1Lineup?.[slot.key] || []).join('/')} vs ${(team2Lineup?.[slot.key] || []).join('/')}\n4-3, 4-3 (won) ${team1.abbreviation}`;
  });
  return `${team1.abbreviation} vs ${team2.abbreviation}\n\n${lines.join('\n\n')}\n\nFinal: ${team1.abbreviation} won 3-2`;
}
