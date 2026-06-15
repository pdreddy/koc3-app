// Resolves a match record's team references using current `teams` map.
// Prefers stored t1Id/t2Id; falls back to name lookup for legacy records.

export function resolveMatchTeams(match, teams) {
  if (!match || !teams) return { team1: null, team2: null };
  const byId = (id) => id && teams[id] ? teams[id] : null;
  const byName = (name) => name ? Object.values(teams).find(t => t.name === name) : null;
  const team1 = byId(match.t1Id) || byName(match.t1) || null;
  const team2 = byId(match.t2Id) || byName(match.t2) || null;
  return { team1, team2 };
}

export function matchTeamNames(match, teams) {
  const { team1, team2 } = resolveMatchTeams(match, teams);
  return {
    t1Name: team1 ? team1.name : (match.t1 || 'Unknown'),
    t2Name: team2 ? team2.name : (match.t2 || 'Unknown'),
    t1Abbr: team1 ? team1.abbreviation : (match.t1Abbr || '?'),
    t2Abbr: team2 ? team2.abbreviation : (match.t2Abbr || '?'),
    team1Id: team1 ? team1.id : match.t1Id,
    team2Id: team2 ? team2.id : match.t2Id
  };
}

// Winner: prefer winnerId; fallback to comparing win (name) to resolved teams
export function matchWinnerId(match, teams) {
  if (match.winnerId) return match.winnerId;
  const { team1, team2 } = resolveMatchTeams(match, teams);
  if (match.win && team1 && match.win === team1.name) return team1.id;
  if (match.win && team2 && match.win === team2.name) return team2.id;
  return null;
}
