import { resolveMatchTeams } from './matchTeams';

const DEFAULT_BASE_RATING = 7.0;
const MIN_RATING = 1.0;
const MAX_RATING = 16.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function playerUtr(player) {
  const raw = player?.utr ?? player?.currentUtr ?? player?.rating ?? '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function expectedWinChance(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 4));
}

function ptlScoreForCourt({ won, gamesFor, gamesAgainst }) {
  const totalGames = Math.max(1, gamesFor + gamesAgainst);
  const gameMargin = clamp((gamesFor - gamesAgainst) / totalGames, -1, 1);
  return clamp((won ? 1 : 0) + gameMargin * 0.18, 0, 1);
}

function buildPlayerIndex(teams) {
  const players = {};
  Object.values(teams || {}).forEach(team => {
    (team.players || []).forEach(player => {
      const key = normalizeName(player.name);
      if (!key) return;
      const utr = playerUtr(player);
      players[key] = {
        name: player.name,
        team: team.name,
        teamAbbr: team.abbreviation,
        currentUtr: utr,
        ptlRating: utr || DEFAULT_BASE_RATING,
        courts: 0,
        wins: 0,
        losses: 0,
        singles: 0,
        doubles: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        ratingDelta: 0
      };
    });
  });
  return players;
}

function ensurePlayer(players, name, team) {
  const key = normalizeName(name);
  if (!players[key]) {
    players[key] = {
      name,
      team: team?.name || 'Unknown',
      teamAbbr: team?.abbreviation || '?',
      currentUtr: null,
      ptlRating: DEFAULT_BASE_RATING,
      courts: 0,
      wins: 0,
      losses: 0,
      singles: 0,
      doubles: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      ratingDelta: 0
    };
  }
  return players[key];
}

function applyCourtRating(players, playerNames, opponentNames, context) {
  const playerRecords = playerNames.map(name => ensurePlayer(players, name, context.team));
  const opponentRecords = opponentNames.map(name => ensurePlayer(players, name, context.opponentTeam));
  const opponentAverage = opponentRecords.reduce((sum, p) => sum + p.ptlRating, 0) / Math.max(1, opponentRecords.length);

  playerRecords.forEach(player => {
    const before = player.ptlRating;
    const expected = expectedWinChance(before, opponentAverage);
    const actual = ptlScoreForCourt(context);
    const confidence = Math.min(player.courts, 12);
    const kFactor = 0.34 - confidence * 0.012;
    const delta = clamp((actual - expected) * kFactor, -0.22, 0.22);

    player.ptlRating = clamp(before + delta, MIN_RATING, MAX_RATING);
    player.ratingDelta += delta;
    player.courts += 1;
    if (context.won) player.wins += 1;
    else player.losses += 1;
    if (context.type === 'singles') player.singles += 1;
    else player.doubles += 1;
    player.gamesFor += context.gamesFor;
    player.gamesAgainst += context.gamesAgainst;
  });
}

export function buildPtlRatings(teams, matches) {
  const players = buildPlayerIndex(teams);
  const chronological = [...(matches || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  chronological.forEach(match => {
    const { team1, team2 } = resolveMatchTeams(match, teams);
    (match.lines || []).forEach(line => {
      const t1Players = line.players?.team1 || [];
      const t2Players = line.players?.team2 || [];
      if (t1Players.length === 0 || t2Players.length === 0) return;
      const g1 = Number(line.g1) || 0;
      const g2 = Number(line.g2) || 0;
      if (g1 === g2) return;
      const team1Won = g1 > g2;

      applyCourtRating(players, t1Players, t2Players, {
        team: team1,
        opponentTeam: team2,
        won: team1Won,
        gamesFor: g1,
        gamesAgainst: g2,
        type: line.type
      });
      applyCourtRating(players, t2Players, t1Players, {
        team: team2,
        opponentTeam: team1,
        won: !team1Won,
        gamesFor: g2,
        gamesAgainst: g1,
        type: line.type
      });
    });
  });

  return Object.values(players)
    .map(player => ({
      ...player,
      winPct: player.courts ? Math.round((player.wins / player.courts) * 100) : 0,
      gameDiff: player.gamesFor - player.gamesAgainst,
      ptlRating: Number(player.ptlRating.toFixed(2)),
      ratingDelta: Number(player.ratingDelta.toFixed(2))
    }))
    .sort((a, b) => b.ptlRating - a.ptlRating || b.wins - a.wins || a.name.localeCompare(b.name));
}
