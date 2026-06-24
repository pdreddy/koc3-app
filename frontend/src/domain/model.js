// Domain model for the club platform.
//
// Hierarchy: Club → Season → Event → Team → Player → Match.
// These factories define the canonical shapes even though today's UI runs a
// single club/season. Players are modeled as a TOP-LEVEL identity that exists
// independent of any season, so history and ratings can follow a person across
// seasons and clubs. Matches are stored in a normalized, rating-ready shape so a
// future computed-rating engine can consume them without a migration.

function id(prefix, value) {
  if (value) return String(value);
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeClub({ clubId, name = '', logoEmoji = '🏆', colors = {} } = {}) {
  return { id: id('club', clubId), name, logoEmoji, colors, createdAt: Date.now() };
}

export function makeSeason({ seasonId, clubId, name = '', sportId = 'tennis', configVersion = null } = {}) {
  return { id: id('season', seasonId), clubId, name, sportId, configVersion, createdAt: Date.now() };
}

export function makeEvent({ eventId, seasonId, name = '', formatType = 'round_robin' } = {}) {
  return { id: id('event', eventId), seasonId, name, formatType, createdAt: Date.now() };
}

export function makeTeam({ teamId, eventId, name = '', abbreviation = '', color = '', logoUrl = '', captainPlayerId = '', playerIds = [] } = {}) {
  return { id: id('team', teamId), eventId, name, abbreviation, color, logoUrl, captainPlayerId, playerIds };
}

// A Player is a durable, top-level identity. `globalId` is stable across
// seasons; per-season membership lives in Team.playerIds, not here.
export function makePlayer({ playerId, name = '', ratings = {}, externalIds = {} } = {}) {
  return {
    id: id('player', playerId),
    name,
    ratings,          // { UTR: 5.2, NTRP: 4.0, ... } — last-known, by system
    externalIds,      // { utrId, duprId, ... } for future integrations
    createdAt: Date.now()
  };
}

// Stable id for a player derived from name, so legacy roster entries (which key
// players by name) map onto persistent identities deterministically.
export function playerIdFromName(name) {
  return 'player_' + String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Convert an existing stored match record (the current KOC3 shape) into the
// normalized, rating-ready shape WITHOUT changing what is persisted. Rating
// providers and analytics consume this, decoupling them from storage details.
export function toNormalizedMatch(match, teams = {}, ctx = {}) {
  if (!match) return null;
  const t1 = teams[match.t1Id] || teams[match.team1Id];
  const t2 = teams[match.t2Id] || teams[match.team2Id];
  const winnerName = match.win || match.winner;
  const winnerTeamId = match.winnerId
    || (winnerName && t1?.name === winnerName ? t1?.id : undefined)
    || (winnerName && t2?.name === winnerName ? t2?.id : undefined);

  const lines = (match.lines || []).map((line, idx) => {
    const side1 = line.players?.team1 || [];
    const side2 = line.players?.team2 || [];
    const g1 = Number(line.g1) || 0;
    const g2 = Number(line.g2) || 0;
    return {
      lineId: line.id || `line${idx + 1}`,
      discipline: line.type === 'doubles' ? 'doubles' : 'singles',
      side1Players: side1.map(playerIdFromName),
      side2Players: side2.map(playerIdFromName),
      side1Names: side1,
      side2Names: side2,
      gamesWonSide1: g1,
      gamesWonSide2: g2,
      sets: line.sets || [],
      winnerSide: g1 === g2 ? null : (g1 > g2 ? 1 : 2)
    };
  });

  // Per-player rating inputs: opponent/partner ids, win/loss, games — exactly
  // what an Elo/UTR-style engine needs.
  const ratingInputs = [];
  lines.forEach(line => {
    const record = (playerIds, opponentIds, partnerIds, won, gw, gl) => {
      playerIds.forEach(pid => ratingInputs.push({
        playerId: pid, opponentIds, partnerIds, won,
        gamesWon: gw, gamesLost: gl,
        discipline: line.discipline, date: match.date || match.ts || null
      }));
    };
    if (line.winnerSide === 1 || line.winnerSide === 2) {
      const s1Won = line.winnerSide === 1;
      record(line.side1Players, line.side2Players, line.side1Players, s1Won, line.gamesWonSide1, line.gamesWonSide2);
      record(line.side2Players, line.side1Players, line.side2Players, !s1Won, line.gamesWonSide2, line.gamesWonSide1);
    }
  });

  return {
    id: match.id,
    clubId: ctx.clubId || null,
    seasonId: ctx.seasonId || null,
    eventId: match.eventId || null,
    date: match.date || (match.ts ? new Date(match.ts).toISOString().slice(0, 10) : null),
    teams: [t1?.id || match.t1Id || match.team1Id, t2?.id || match.t2Id || match.team2Id],
    teamNames: [t1?.name || match.t1, t2?.name || match.t2],
    result: { winnerTeamId, setsTeam1: Number(match.s1) || 0, setsTeam2: Number(match.s2) || 0 },
    lines,
    ratingInputs,
    source: match.source || 'current'
  };
}
