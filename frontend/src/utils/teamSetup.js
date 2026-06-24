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
