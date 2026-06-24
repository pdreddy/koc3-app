function cleanId(value, fallback) {
  return String(value || fallback || 'team')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || fallback;
}

function groupLabel(index, groupsCount) {
  return String.fromCharCode(65 + (index % Math.max(1, groupsCount)));
}

function ratingFromLookup(name, lookupRows = []) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  const row = lookupRows.find(item => String(item.fullName || item.name || '').trim().toLowerCase() === key);
  return row?.utr ?? row?.rating ?? row?.actualUtr ?? '';
}

export const CLUB_TEAM_PRESETS = {
  koc: { clubKey: 'koc', teamPrefix: 'KOC Team', abbreviationPrefix: 'KOC', passwordPrefix: 'KOC', groupsCount: 2 },
  triace: { clubKey: 'triace', teamPrefix: 'Triace Team', abbreviationPrefix: 'TRI', passwordPrefix: 'TRI', groupsCount: 2 }
};

export function buildPlaceholderPlayer(teamIndex, playerIndex, playerNames = [], lookupRows = []) {
  const suppliedName = playerNames[playerIndex] || '';
  const name = suppliedName.trim() || `Player ${teamIndex + 1}-${playerIndex + 1}`;
  return {
    slot: playerIndex + 1,
    name,
    isCaptain: playerIndex === 0,
    utr: ratingFromLookup(name, lookupRows),
    source: suppliedName.trim() ? 'manual' : 'placeholder'
  };
}

export function buildConfigurableTeams(options = {}) {
  const preset = CLUB_TEAM_PRESETS[options.clubKey] || CLUB_TEAM_PRESETS.koc;
  const teamCount = Math.max(1, Number.parseInt(options.teamCount, 10) || 1);
  const playersPerTeam = Math.max(1, Number.parseInt(options.playersPerTeam, 10) || 1);
  const groupsCount = Math.max(1, Number.parseInt(options.groupsCount ?? preset.groupsCount, 10) || 1);
  const lookupRows = options.lookupRows || [];
  const existingTeams = options.existingTeams || {};
  const teams = {};

  for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
    const teamNumber = teamIndex + 1;
    const existing = existingTeams[`team${teamNumber}`] || {};
    const playerNames = options.playerNamesByTeam?.[teamIndex] || [];
    const id = cleanId(options.teamIds?.[teamIndex], `team${teamNumber}`);
    const abbreviation = String(options.abbreviations?.[teamIndex] || existing.abbreviation || `${preset.abbreviationPrefix}${teamNumber}`).toUpperCase().slice(0, 6);
    const players = Array.from({ length: playersPerTeam }, (_, playerIndex) => {
      const existingPlayer = existing.players?.[playerIndex] || {};
      return {
        ...buildPlaceholderPlayer(teamIndex, playerIndex, playerNames, lookupRows),
        ...existingPlayer,
        name: playerNames[playerIndex]?.trim() || existingPlayer.name || `Player ${teamNumber}-${playerIndex + 1}`,
        isCaptain: playerIndex === 0 || !!existingPlayer.isCaptain,
        utr: existingPlayer.utr || ratingFromLookup(playerNames[playerIndex] || existingPlayer.name, lookupRows)
      };
    });

    teams[id] = {
      id,
      name: options.teamNames?.[teamIndex] || existing.name || `${preset.teamPrefix} ${teamNumber}`,
      abbreviation,
      password: existing.password || `${preset.passwordPrefix}${abbreviation}#${teamNumber}`,
      group: existing.group || groupLabel(teamIndex, groupsCount),
      groupOrder: existing.groupOrder || Math.floor(teamIndex / groupsCount) + 1,
      gradient: existing.gradient || teamNumber,
      captain: players.find(player => player.isCaptain)?.name || players[0]?.name || '',
      players
    };
  }
  return teams;
}

export function playerLookupRows(playerRatings = {}) {
  return Object.entries(playerRatings || {}).map(([id, row]) => ({ id, ...(row || {}) }));
}

export const GAME_FORMAT_PRESETS = {
  miniSet4: { key: 'miniSet4', label: 'Mini Set (4 games)', gamesPerSet: 4, setCount: 3, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 },
  regular6: { key: 'regular6', label: 'Regular Set (6 games)', gamesPerSet: 6, setCount: 3, noAd: false, tiebreakAt: 6, tiebreakPoints: 7 },
  proSet8: { key: 'proSet8', label: 'Pro Set (8 games)', gamesPerSet: 8, setCount: 1, noAd: false, tiebreakAt: 8, tiebreakPoints: 7 }
};

export function buildTournamentConfig(options = {}) {
  const preset = GAME_FORMAT_PRESETS[options.gameFormat] || GAME_FORMAT_PRESETS.miniSet4;
  const maxPlayers = Math.max(1, Number.parseInt(options.playersPerTeam, 10) || 1);
  const minPlays = Math.max(0, Number.parseInt(options.minPlaysPerPlayer, 10) || 0);
  const maxPlays = Math.max(minPlays || 1, Number.parseInt(options.maxPlaysPerPlayer, 10) || maxPlayers);
  const noAd = options.noAd === undefined ? preset.noAd : !!options.noAd;
  const setCount = Math.max(1, Number.parseInt(options.setCount ?? preset.setCount, 10) || preset.setCount);
  const gamesPerSet = Math.max(1, Number.parseInt(options.gamesPerSet ?? preset.gamesPerSet, 10) || preset.gamesPerSet);

  return {
    leagueConfig: {
      leagueName: options.tournamentName || `${String(options.clubKey || 'KOC').toUpperCase()} Tournament`,
      clubName: String(options.clubKey || 'koc').toUpperCase(),
      gameStyle: preset.label,
      teamCount: Math.max(1, Number.parseInt(options.teamCount, 10) || 1),
      groupsCount: Math.max(1, Number.parseInt(options.groupsCount, 10) || 1),
      minPlayersPerTeam: maxPlayers,
      maxPlayersPerTeam: maxPlayers,
      activePlayersPerMatch: Math.min(maxPlayers, Number.parseInt(options.activePlayersPerMatch, 10) || Math.min(5, maxPlayers)),
      linesPerMatch: Number.parseInt(options.linesPerMatch, 10) || 5,
      singlesLines: Number.parseInt(options.singlesLines, 10) || 1,
      doublesLines: Math.max(0, (Number.parseInt(options.linesPerMatch, 10) || 5) - (Number.parseInt(options.singlesLines, 10) || 1))
    },
    scoringConfig: {
      noAd,
      gamesPerSet,
      templates: [
        { id: 'singles-1', label: 'Singles', type: 'singles', playersPerSide: 1, setCount, gamesPerSet, noAd, tiebreakAt: preset.tiebreakAt, tiebreakPoints: preset.tiebreakPoints },
        { id: 'doubles-1', label: 'Doubles 1', type: 'doubles', playersPerSide: 2, setCount, gamesPerSet, noAd, tiebreakAt: preset.tiebreakAt, tiebreakPoints: preset.tiebreakPoints },
        { id: 'doubles-1-rev', label: 'Doubles 1 Reverse', type: 'doubles', playersPerSide: 2, setCount, gamesPerSet, noAd, tiebreakAt: preset.tiebreakAt, tiebreakPoints: preset.tiebreakPoints },
        { id: 'doubles-2', label: 'Doubles 2', type: 'doubles', playersPerSide: 2, setCount, gamesPerSet, noAd, tiebreakAt: preset.tiebreakAt, tiebreakPoints: preset.tiebreakPoints },
        { id: 'doubles-2-rev', label: 'Doubles 2 Reverse', type: 'doubles', playersPerSide: 2, setCount, gamesPerSet, noAd, tiebreakAt: preset.tiebreakAt, tiebreakPoints: preset.tiebreakPoints }
      ]
    },
    eligibilityRules: {
      minMatchDays: minPlays,
      maxTotalMatchDays: maxPlays,
      maxSinglesDays: Math.max(1, Number.parseInt(options.maxSinglesDays, 10) || Math.ceil(maxPlays / 2) || 1),
      maxPartnerDays: Math.max(1, Number.parseInt(options.maxPartnerDays, 10) || Math.ceil(maxPlays / 2) || 1)
    }
  };
}
