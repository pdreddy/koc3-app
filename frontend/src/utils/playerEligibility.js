export const KOC_SEASON_ID = 'koc_s3';
export const MAX_MATCH_DAYS = 5;
export const MAX_SINGLES_DAYS = 2;
export const MAX_PARTNER_DAYS = 3;

export function playerId(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function cleanName(name) {
  return String(name || '').trim();
}

function pairId(names) {
  return names.map(playerId).sort().join('__');
}

function emptyStats(name, teamId) {
  return {
    playerId: playerId(name),
    name,
    teamId,
    seasonId: KOC_SEASON_ID,
    totalMatchDays: 0,
    singlesDays: 0,
    doublesDays: 0,
    partnerHistory: {}
  };
}

function addDay(stats, { singles = false, doubles = false, partners = [] } = {}) {
  stats.totalMatchDays += 1;
  if (singles) stats.singlesDays += 1;
  if (doubles) stats.doublesDays += 1;
  partners.forEach(partner => {
    const partnerKey = playerId(partner);
    if (!partnerKey) return;
    stats.partnerHistory[partnerKey] = (stats.partnerHistory[partnerKey] || 0) + 1;
  });
}

function sideForTeam(match, teamId) {
  if (match.t1Id === teamId || match.team1Id === teamId) return 'team1';
  if (match.t2Id === teamId || match.team2Id === teamId) return 'team2';
  return null;
}

function collectTeamDay(lines, side) {
  const players = new Map();
  const pairDays = new Set();
  (lines || []).forEach(line => {
    const names = (line.players?.[side] || []).map(cleanName).filter(Boolean);
    if (names.length === 0) return;
    names.forEach(name => {
      const key = playerId(name);
      const current = players.get(key) || { name, singles: false, doubles: false, partners: new Set() };
      if (line.type === 'singles') current.singles = true;
      if (line.type === 'doubles') current.doubles = true;
      players.set(key, current);
    });
    if (line.type === 'doubles' && names.length === 2) {
      const [a, b] = names;
      const aKey = playerId(a);
      const bKey = playerId(b);
      const pairKey = pairId(names);
      pairDays.add(pairKey);
      players.get(aKey)?.partners.add(b);
      players.get(bKey)?.partners.add(a);
    }
  });
  return { players, pairDays };
}

function teamRosterMap(team) {
  const roster = new Map();
  (team?.players || []).forEach(player => roster.set(playerId(player.name), player.name));
  return roster;
}

export function buildEligibilityStats(matches = [], teams = {}) {
  const statsByTeam = {};
  const pairDaysByTeam = {};

  Object.values(teams || {}).forEach(team => {
    statsByTeam[team.id] = {};
    pairDaysByTeam[team.id] = {};
    (team.players || []).forEach(player => {
      statsByTeam[team.id][playerId(player.name)] = emptyStats(player.name, team.id);
    });
  });

  (matches || []).forEach(match => {
    ['t1Id', 't2Id'].forEach(key => {
      const teamId = match[key] || (key === 't1Id' ? match.team1Id : match.team2Id);
      const side = sideForTeam(match, teamId);
      if (!teamId || !side) return;
      if (!statsByTeam[teamId]) statsByTeam[teamId] = {};
      if (!pairDaysByTeam[teamId]) pairDaysByTeam[teamId] = {};
      const day = collectTeamDay(match.lines || [], side);
      day.players.forEach((entry, id) => {
        if (!statsByTeam[teamId][id]) statsByTeam[teamId][id] = emptyStats(entry.name, teamId);
        addDay(statsByTeam[teamId][id], {
          singles: entry.singles,
          doubles: entry.doubles,
          partners: Array.from(entry.partners)
        });
      });
      day.pairDays.forEach(id => {
        pairDaysByTeam[teamId][id] = (pairDaysByTeam[teamId][id] || 0) + 1;
      });
    });
  });

  return { statsByTeam, pairDaysByTeam };
}

export function validateEligibilityForMatch({ lines = [], team1, team2, matches = [], teams = {} }) {
  const errors = [];
  const currentTeams = [
    { team: team1, side: 'team1' },
    { team: team2, side: 'team2' }
  ].filter(item => item.team?.id);
  const history = buildEligibilityStats(matches, teams);
  const currentSnapshots = {};

  currentTeams.forEach(({ team, side }) => {
    const roster = teamRosterMap(team);
    const day = collectTeamDay(lines, side);
    const teamStats = history.statsByTeam[team.id] || {};
    const teamPairDays = history.pairDaysByTeam[team.id] || {};
    currentSnapshots[team.id] = {};

    day.players.forEach((entry, id) => {
      if (!roster.has(id)) {
        errors.push(`${entry.name} is not on ${team.name}.`);
        return;
      }
      const previous = teamStats[id] || emptyStats(entry.name, team.id);
      const next = {
        ...previous,
        totalMatchDays: previous.totalMatchDays + 1,
        singlesDays: previous.singlesDays + (entry.singles ? 1 : 0),
        doublesDays: previous.doublesDays + (entry.doubles ? 1 : 0),
        partnerHistory: { ...previous.partnerHistory }
      };
      entry.partners.forEach(partner => {
        const partnerKey = playerId(partner);
        next.partnerHistory[partnerKey] = (next.partnerHistory[partnerKey] || 0) + 1;
      });
      currentSnapshots[team.id][id] = next;

      if (next.totalMatchDays > MAX_MATCH_DAYS) errors.push(`${entry.name} exceeds ${MAX_MATCH_DAYS} total match days.`);
      if (next.singlesDays > MAX_SINGLES_DAYS) errors.push(`${entry.name} exceeds ${MAX_SINGLES_DAYS} singles days.`);
    });

    day.pairDays.forEach(id => {
      const nextCount = (teamPairDays[id] || 0) + 1;
      if (nextCount > MAX_PARTNER_DAYS) {
        const names = id.split('__').map(partId => day.players.get(partId)?.name || partId).join(' + ');
        errors.push(`${team.abbreviation || team.name}: ${names} exceed ${MAX_PARTNER_DAYS} doubles partner match days.`);
      }
    });
  });

  return { valid: errors.length === 0, errors, snapshots: currentSnapshots };
}
