import { AUCTION_TEAMS, buildAuctionTeams, groupInfoForTeamId, normalizeAuctionPlayer } from './auctionTeams';

const canonicalTeams = AUCTION_TEAMS.map(team => ({
  ...team,
  roster: team.players.map((player, index) => normalizeAuctionPlayer(player, index).name)
}));

export const LEGACY_RR_TEAM_NAMES = [
  ['Rally', 'Royals'].join(' '),
  `${['Rally', 'Royals'].join(' ')} 🎾`
];

const LEGACY_TEAM_NAMES_BY_ABBR = {
  RR: LEGACY_RR_TEAM_NAMES
};

function shouldApplyCanonicalTeamName(team, canonicalTeam) {
  if (!team.name) return true;
  const legacyNames = LEGACY_TEAM_NAMES_BY_ABBR[canonicalTeam.abbreviation] || [];
  return legacyNames.includes(team.name);
}



export function teamIdFromNumber(id) {
  return `team${id}`;
}

export function buildInitialTeams() {
  return buildAuctionTeams();
}

function canonicalPlayersForExistingTeam(team, t) {
  return t.players.map((player, index) => normalizeAuctionPlayer(player, index));
}

export function canonicalTeamIdentityUpdates(teamsData = {}) {
  return canonicalTeams.reduce((updates, t, idx) => {
    const id = teamIdFromNumber(t.id);
    const team = teamsData[id] || {};
    const nextPlayers = canonicalPlayersForExistingTeam(team, t);

    if (shouldApplyCanonicalTeamName(team, t)) updates[`${id}/name`] = t.name;
    if (!team.abbreviation) updates[`${id}/abbreviation`] = t.abbreviation;
    if (!team.gradient) updates[`${id}/gradient`] = idx + 1;
    const groupInfo = groupInfoForTeamId(id, idx);
    if (!team.group) updates[`${id}/group`] = groupInfo.group;
    if (!team.groupOrder) updates[`${id}/groupOrder`] = groupInfo.groupOrder;
    if (!team.password) updates[`${id}/password`] = `KOC${t.abbreviation}#3`;
    if (!team.id) updates[`${id}/id`] = id;
    if (team.totalSpent == null) updates[`${id}/totalSpent`] = t.totalSpent;
    if (team.moneyLeft == null) updates[`${id}/moneyLeft`] = t.moneyLeft;
    if (!Array.isArray(team.players) || team.players.length === 0) updates[`${id}/players`] = nextPlayers;
    return updates;
  }, {});
}

export const DEFAULT_ADMIN_PASSWORD = 'KOCPO#ADMIN';

export const ADMIN_USERNAME_ALIASES = {
  damureddi: 'damuredii',
  vinoda: 'vionda',
  viona: 'vionda'
};

export function normalizeAdminUsername(username) {
  const normalized = String(username || '').trim().toLowerCase();
  return ADMIN_USERNAME_ALIASES[normalized] || normalized;
}

export const DEFAULT_ADMIN_USERS = {
  damuredii: {
    username: 'damuredii',
    name: 'Damureddi',
    role: 'SUPER_ADMIN'
  },
  vionda: {
    username: 'vionda',
    name: 'Vionda',
    role: 'ADMIN'
  },
  umav: {
    username: 'umav',
    name: 'Umav',
    role: 'ADMIN'
  }
};
