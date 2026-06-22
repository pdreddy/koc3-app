import { resolveMatchTeams } from './matchTeams';
import { findUtrRating } from '../data/utrRatings';

const DEFAULT_BASE_RATING = 3.5;
const MIN_RATING = 1.0;
const MAX_RATING = 16.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function numericRating(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function playerUtr(player, type, ratingRows) {
  const lookup = findUtrRating(player?.name, ratingRows);
  if (type === 'singles') {
    return numericRating(player?.singlesUtr) ?? numericRating(player?.utr) ?? lookup?.singlesUtr ?? null;
  }
  return numericRating(player?.doublesUtr) ?? numericRating(player?.utr) ?? lookup?.doublesUtr ?? null;
}

function canonicalPlayerInfo(name, ratingRows) {
  const lookup = findUtrRating(name, ratingRows);
  return {
    key: normalizeName(lookup?.fullName || name),
    displayName: lookup?.fullName || name,
    lookup,
    hasUtrLookup: !!lookup
  };
}

function expectedWinChance(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 4));
}


function seasonLabel(source) {
  const clean = String(source || '').trim();
  if (!clean) return 'Unknown season';
  if (/koc3/i.test(clean)) return 'KOC3';
  if (/season\s*2|koc2/i.test(clean)) return 'Season 2';
  return clean;
}

function teamLabel(team) {
  return team?.abbreviation || team?.name || '?';
}

function addSeasonTeam(player, source, team) {
  if (!player) return;
  const label = `${seasonLabel(source)} / ${teamLabel(team)}`;
  if (!player.seasonTeams) player.seasonTeams = new Set();
  player.seasonTeams.add(label);
}

function pprcScoreForCourt({ won, gamesFor, gamesAgainst }) {
  const totalGames = Math.max(1, gamesFor + gamesAgainst);
  const gameMargin = clamp((gamesFor - gamesAgainst) / totalGames, -1, 1);
  return clamp((won ? 1 : 0) + gameMargin * 0.18, 0, 1);
}

function buildPlayerIndex(teams, ratingRows) {
  const players = {};
  Object.values(teams || {}).forEach(team => {
    (team.players || []).forEach(player => {
      const canonical = canonicalPlayerInfo(player.name, ratingRows);
      const key = canonical.key;
      if (!key) return;
      const singlesUtr = playerUtr(player, 'singles', ratingRows);
      const doublesUtr = playerUtr(player, 'doubles', ratingRows);
      if (players[key]) {
        players[key].team = players[key].team || team.name;
        players[key].teamAbbr = players[key].teamAbbr || team.abbreviation;
        return;
      }
      players[key] = {
        name: canonical.displayName,
        team: team.name,
        teamAbbr: team.abbreviation,
        currentSinglesUtr: singlesUtr,
        currentDoublesUtr: doublesUtr,
        hasUtrLookup: canonical.hasUtrLookup,
        lookupName: canonical.lookup?.fullName || '',
        pprcSinglesRating: singlesUtr || DEFAULT_BASE_RATING,
        pprcDoublesRating: doublesUtr || DEFAULT_BASE_RATING,
        courts: 0,
        wins: 0,
        losses: 0,
        singles: 0,
        doubles: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        ratingDelta: 0,
        seasonTeams: new Set([`KOC3 / ${teamLabel(team)}`])
      };
    });
  });
  return players;
}

function ensurePlayer(players, name, team, ratingRows) {
  const canonical = canonicalPlayerInfo(name, ratingRows);
  const key = canonical.key;
  if (!players[key]) {
    players[key] = {
      name: canonical.displayName,
      team: team?.name || 'Unknown',
      teamAbbr: team?.abbreviation || '?',
      currentSinglesUtr: canonical.lookup?.singlesUtr ?? null,
      currentDoublesUtr: canonical.lookup?.doublesUtr ?? null,
      hasUtrLookup: canonical.hasUtrLookup,
      lookupName: canonical.lookup?.fullName || '',
      pprcSinglesRating: canonical.lookup?.singlesUtr || DEFAULT_BASE_RATING,
      pprcDoublesRating: canonical.lookup?.doublesUtr || DEFAULT_BASE_RATING,
      courts: 0,
      wins: 0,
      losses: 0,
      singles: 0,
      doubles: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      ratingDelta: 0,
      seasonTeams: new Set()
    };
  }
  return players[key];
}

function applyCourtRating(players, playerNames, opponentNames, context, ratingRows) {
  const playerRecords = playerNames.map(name => ensurePlayer(players, name, context.team, ratingRows));
  const opponentRecords = opponentNames.map(name => ensurePlayer(players, name, context.opponentTeam, ratingRows));
  playerRecords.forEach(player => addSeasonTeam(player, context.source, context.team));
  opponentRecords.forEach(player => addSeasonTeam(player, context.source, context.opponentTeam));
  const ratingKey = context.type === 'singles' ? 'pprcSinglesRating' : 'pprcDoublesRating';
  const deltaKey = context.type === 'singles' ? 'singlesRatingDelta' : 'doublesRatingDelta';
  const opponentAverage = opponentRecords.reduce((sum, p) => sum + p[ratingKey], 0) / Math.max(1, opponentRecords.length);

  playerRecords.forEach(player => {
    const before = player[ratingKey];
    const expected = expectedWinChance(before, opponentAverage);
    const actual = pprcScoreForCourt(context);
    const confidence = Math.min(player.courts, 12);
    const kFactor = 0.34 - confidence * 0.012;
    const delta = clamp((actual - expected) * kFactor, -0.22, 0.22);

    player[ratingKey] = clamp(before + delta, MIN_RATING, MAX_RATING);
    player.ratingDelta += delta;
    player[deltaKey] = (player[deltaKey] || 0) + delta;
    player.courts += 1;
    if (context.won) player.wins += 1;
    else player.losses += 1;
    if (context.type === 'singles') player.singles += 1;
    else player.doubles += 1;
    player.gamesFor += context.gamesFor;
    player.gamesAgainst += context.gamesAgainst;
  });
}

export function buildPprcRatings(teams, matches, ratingRows) {
  const players = buildPlayerIndex(teams, ratingRows);
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
        type: line.type,
        source: match.source
      }, ratingRows);
      applyCourtRating(players, t2Players, t1Players, {
        team: team2,
        opponentTeam: team1,
        won: !team1Won,
        gamesFor: g2,
        gamesAgainst: g1,
        type: line.type,
        source: match.source
      }, ratingRows);
    });
  });

  return Object.values(players)
    .map(player => ({
      ...player,
      winPct: player.courts ? Math.round((player.wins / player.courts) * 100) : 0,
      gameDiff: player.gamesFor - player.gamesAgainst,
      pprcSinglesRating: Number(player.pprcSinglesRating.toFixed(2)),
      pprcDoublesRating: Number(player.pprcDoublesRating.toFixed(2)),
      pprcRating: Number((((player.pprcSinglesRating || DEFAULT_BASE_RATING) + (player.pprcDoublesRating || DEFAULT_BASE_RATING)) / 2).toFixed(2)),
      seasonTeamSummary: Array.from(player.seasonTeams || []).sort().join(', '),
      ratingDelta: Number(player.ratingDelta.toFixed(2)),
      singlesRatingDelta: Number((player.singlesRatingDelta || 0).toFixed(2)),
      doublesRatingDelta: Number((player.doublesRatingDelta || 0).toFixed(2))
    }))
    .sort((a, b) => b.pprcRating - a.pprcRating || b.wins - a.wins || a.name.localeCompare(b.name));
}
