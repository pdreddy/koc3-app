import { get, ref, remove, update } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { buildPprcRatings } from '../utils/pprcRating';
import { matchTeamNames, matchWinnerId } from '../utils/matchTeams';
import { logAuditEvent } from '../utils/auditLog';

const DERIVED_VERSION = 1;

function approvedMatches(matches = []) {
  return matches.filter(match => (match.status || 'APPROVED') === 'APPROVED');
}

function lineWinner(line) {
  const g1 = Number(line.g1) || 0;
  const g2 = Number(line.g2) || 0;
  if (g1 === g2) return null;
  return g1 > g2 ? 'team1' : 'team2';
}

function ensureTeam(stats, team) {
  if (!team?.id) return null;
  if (!stats[team.id]) {
    stats[team.id] = {
      teamId: team.id,
      team: team.name,
      abbreviation: team.abbreviation,
      matches: 0,
      points: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      singlesWins: 0,
      position: 0
    };
  }
  return stats[team.id];
}

function buildStandings(matches, teams) {
  const stats = {};
  Object.values(teams || {}).forEach(team => ensureTeam(stats, team));
  const headToHead = {};

  approvedMatches(matches).forEach(match => {
    const names = matchTeamNames(match, teams);
    const team1 = teams[names.team1Id] || { id: names.team1Id, name: names.t1Name, abbreviation: names.t1Abbr };
    const team2 = teams[names.team2Id] || { id: names.team2Id, name: names.t2Name, abbreviation: names.t2Abbr };
    const s1 = ensureTeam(stats, team1);
    const s2 = ensureTeam(stats, team2);
    if (!s1 || !s2) return;

    const winnerId = matchWinnerId(match, teams);
    s1.matches += 1; s2.matches += 1;
    s1.gamesWon += Number(match.g1) || 0; s1.gamesLost += Number(match.g2) || 0;
    s2.gamesWon += Number(match.g2) || 0; s2.gamesLost += Number(match.g1) || 0;
    s1.setsWon += Number(match.s1) || 0; s1.setsLost += Number(match.s2) || 0;
    s2.setsWon += Number(match.s2) || 0; s2.setsLost += Number(match.s1) || 0;

    (match.lines || []).forEach(line => {
      if (line.type !== 'singles') return;
      const won = lineWinner(line);
      if (won === 'team1') s1.singlesWins += 1;
      if (won === 'team2') s2.singlesWins += 1;
    });

    if (winnerId === team1.id) { s1.wins += 1; s2.losses += 1; s1.points += 1; }
    if (winnerId === team2.id) { s2.wins += 1; s1.losses += 1; s2.points += 1; }

    const key = [team1.id, team2.id].sort().join('__');
    headToHead[key] = headToHead[key] || {};
    if (winnerId) headToHead[key][winnerId] = (headToHead[key][winnerId] || 0) + 1;
  });

  const rows = Object.values(stats).map(row => ({
    ...row,
    gamesDiff: row.gamesWon - row.gamesLost,
    setsDiff: row.setsWon - row.setsLost
  })).sort((a, b) => {
    const h2hKey = [a.teamId, b.teamId].sort().join('__');
    const h2h = (headToHead[h2hKey]?.[b.teamId] || 0) - (headToHead[h2hKey]?.[a.teamId] || 0);
    return (b.points - a.points) || (b.setsWon - a.setsWon) || (b.singlesWins - a.singlesWins) || h2h || (b.gamesDiff - a.gamesDiff) || a.team.localeCompare(b.team);
  });
  rows.forEach((row, index) => { row.position = index + 1; });
  return rows;
}

function playerId(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
}

function ensurePlayer(players, name, team) {
  const key = playerId(name);
  if (!players[key]) {
    players[key] = {
      playerId: key,
      name,
      team: team?.name || 'Unknown',
      teamId: team?.id || '',
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      singlesWins: 0,
      singlesLosses: 0,
      doublesWins: 0,
      doublesLosses: 0,
      history: []
    };
  }
  return players[key];
}

function buildHistories(matches, teams) {
  const players = {};
  const playerVsPlayer = {};
  const teamVsTeam = {};

  approvedMatches(matches).forEach(match => {
    const names = matchTeamNames(match, teams);
    const team1 = teams[names.team1Id] || { id: names.team1Id, name: names.t1Name, abbreviation: names.t1Abbr };
    const team2 = teams[names.team2Id] || { id: names.team2Id, name: names.t2Name, abbreviation: names.t2Abbr };
    const winnerId = matchWinnerId(match, teams);
    const teamKey = [team1.id, team2.id].sort().join('__');
    if (!teamVsTeam[teamKey]) {
      teamVsTeam[teamKey] = { teams: [team1.name, team2.name], meetings: 0, wins: {}, sets: {}, games: {}, lastPlayed: 0 };
    }
    const tvt = teamVsTeam[teamKey];
    tvt.meetings += 1;
    tvt.wins[team1.id] = (tvt.wins[team1.id] || 0) + (winnerId === team1.id ? 1 : 0);
    tvt.wins[team2.id] = (tvt.wins[team2.id] || 0) + (winnerId === team2.id ? 1 : 0);
    tvt.sets[team1.id] = (tvt.sets[team1.id] || 0) + (Number(match.s1) || 0);
    tvt.sets[team2.id] = (tvt.sets[team2.id] || 0) + (Number(match.s2) || 0);
    tvt.games[team1.id] = (tvt.games[team1.id] || 0) + (Number(match.g1) || 0);
    tvt.games[team2.id] = (tvt.games[team2.id] || 0) + (Number(match.g2) || 0);
    tvt.lastPlayed = Math.max(tvt.lastPlayed || 0, match.ts || 0);

    (match.lines || []).forEach(line => {
      const t1Players = line.players?.team1 || [];
      const t2Players = line.players?.team2 || [];
      const won = lineWinner(line);
      [...t1Players, ...t2Players].forEach((name, idx) => {
        const side = idx < t1Players.length ? 'team1' : 'team2';
        const team = side === 'team1' ? team1 : team2;
        const p = ensurePlayer(players, name, team);
        p.matchesPlayed += 1;
        p.gamesWon += side === 'team1' ? Number(line.g1) || 0 : Number(line.g2) || 0;
        p.gamesLost += side === 'team1' ? Number(line.g2) || 0 : Number(line.g1) || 0;
        p.setsWon += side === 'team1' ? Number(line.s1) || 0 : Number(line.s2) || 0;
        p.setsLost += side === 'team1' ? Number(line.s2) || 0 : Number(line.s1) || 0;
        const playerWon = won === side;
        if (playerWon) p.wins += 1; else p.losses += 1;
        if (line.type === 'singles') {
          if (playerWon) p.singlesWins += 1; else p.singlesLosses += 1;
        } else if (playerWon) p.doublesWins += 1; else p.doublesLosses += 1;
        p.history.push({ matchId: match.id, date: match.ts || 0, opponentTeam: side === 'team1' ? team2.name : team1.name, result: playerWon ? 'W' : 'L', type: line.type });
      });

      t1Players.forEach(a => t2Players.forEach(b => {
        const key = [playerId(a), playerId(b)].sort().join('__');
        if (!playerVsPlayer[key]) playerVsPlayer[key] = { players: [a, b], matchesPlayed: 0, wins: {}, losses: {}, lastResult: '', lastPlayed: 0, winPct: {} };
        const row = playerVsPlayer[key];
        row.matchesPlayed += 1;
        const aWon = won === 'team1';
        row.wins[playerId(a)] = (row.wins[playerId(a)] || 0) + (aWon ? 1 : 0);
        row.losses[playerId(a)] = (row.losses[playerId(a)] || 0) + (aWon ? 0 : 1);
        row.wins[playerId(b)] = (row.wins[playerId(b)] || 0) + (aWon ? 0 : 1);
        row.losses[playerId(b)] = (row.losses[playerId(b)] || 0) + (aWon ? 1 : 0);
        row.lastResult = `${aWon ? a : b} def. ${aWon ? b : a}`;
        row.lastPlayed = Math.max(row.lastPlayed || 0, match.ts || 0);
        row.winPct[playerId(a)] = Math.round(((row.wins[playerId(a)] || 0) / row.matchesPlayed) * 100);
        row.winPct[playerId(b)] = Math.round(((row.wins[playerId(b)] || 0) / row.matchesPlayed) * 100);
      }));
    });
  });

  return { playerHistory: players, playerVsPlayer, teamVsTeam };
}

function normalizeMatch(match) {
  const g1 = Number(match.g1) || 0;
  const g2 = Number(match.g2) || 0;
  if ((!match.t1Id && !match.t1) || (!match.t2Id && !match.t2)) throw new Error('Score validation failed: both teams are required.');
  if (!Array.isArray(match.lines) || match.lines.length === 0) throw new Error('Score validation failed: at least one court is required.');
  if (g1 === g2 && !match.winnerId && !match.win) throw new Error('Score validation failed: winner is required.');
  return { ...match, status: match.status || 'APPROVED' };
}

export class ScoreProcessingService {
  static async processMatchResult(matchId, { session = {}, match = null } = {}) {
    const now = Date.now();
    const [matchesSnap, teamsSnap, ratingsSnap] = await Promise.all([
      get(ref(db, PATHS.matches)),
      get(ref(db, PATHS.teams)),
      get(ref(db, PATHS.playerRatings))
    ]);
    const teams = teamsSnap.val() || {};
    const ratingRows = Object.values(ratingsSnap.val() || {});
    const matchesData = matchesSnap.val() || {};
    if (match) matchesData[matchId] = { ...(matchesData[matchId] || {}), ...match, id: matchId };

    const matches = Object.entries(matchesData).map(([id, value]) => normalizeMatch({ id, ...(value || {}) }));
    const approved = approvedMatches(matches);
    const standings = buildStandings(approved, teams);
    const pprcRatings = buildPprcRatings(teams, approved.map(m => ({ ...m, source: m.source || 'KOC3' })), ratingRows);
    const histories = buildHistories(approved, teams);
    const dashboards = {
      totalApprovedMatches: approved.length,
      lastProcessedMatchId: matchId,
      standingsUpdatedAt: now,
      ratingsUpdatedAt: now
    };

    const updates = {
      [`${PATHS.summaries}/standings`]: { rows: standings, updatedAt: now, updatedBy: session.teamName || session.role || 'system', version: DERIVED_VERSION },
      [`${PATHS.summaries}/pprcRatings`]: { rows: pprcRatings, updatedAt: now, updatedBy: session.teamName || session.role || 'system', version: DERIVED_VERSION },
      [`${PATHS.summaries}/playerHistory`]: { rows: histories.playerHistory, updatedAt: now, version: DERIVED_VERSION },
      [`${PATHS.summaries}/teamHistory`]: { rows: histories.teamVsTeam, updatedAt: now, version: DERIVED_VERSION },
      [`${PATHS.summaries}/matchups/playerVsPlayer`]: { rows: histories.playerVsPlayer, updatedAt: now, version: DERIVED_VERSION },
      [`${PATHS.summaries}/matchups/teamVsTeam`]: { rows: histories.teamVsTeam, updatedAt: now, version: DERIVED_VERSION },
      [`${PATHS.summaries}/dashboard`]: { ...dashboards, updatedAt: now, version: DERIVED_VERSION }
    };
    await update(ref(db), updates);
    await logAuditEvent({ actionType: 'SCORE_PROCESSING_RECALCULATED', session, targetType: 'match', targetId: matchId, newValue: dashboards });
    return { standings, pprcRatings, ...histories, dashboards };
  }

  static async saveMatch(match, { session = {} } = {}) {
    const now = Date.now();
    const normalized = normalizeMatch({
      ...match,
      status: match.status || 'APPROVED',
      createdAt: match.createdAt || now,
      updatedAt: now,
      updatedBy: session.teamName || session.role || 'system',
      approvedBy: match.approvedBy || (session.role || 'system'),
      version: (Number(match.version) || 0) + 1
    });
    const id = normalized.id;
    if (!id) throw new Error('Transaction failed: match id is required.');
    await update(ref(db), { [`${PATHS.matches}/${id}`]: normalized });
    await this.processMatchResult(id, { session, match: normalized });
    await logAuditEvent({ actionType: 'SCORE_ENTRY', session, targetType: 'match', targetId: id, newValue: normalized });
    return normalized;
  }

  static async deleteMatch(matchId, { session = {}, oldValue = null } = {}) {
    await remove(ref(db, `${PATHS.matches}/${matchId}`));
    await this.processMatchResult(matchId, { session });
    await logAuditEvent({ actionType: 'SCORE_DELETE', session, targetType: 'match', targetId: matchId, oldValue });
  }

  static async recalculateAll({ session = {} } = {}) {
    return this.processMatchResult('FULL_RECALCULATION', { session });
  }
}
