export const COMMERCIAL_ROLES = {
  PLATFORM_OWNER: 'platformOwner',
  CLUB_OWNER: 'clubOwner',
  CLUB_ADMIN: 'clubAdmin',
  LEAGUE_DIRECTOR: 'leagueDirector',
  CAPTAIN: 'captain',
  PLAYER: 'player',
  FINANCE_ADMIN: 'financeAdmin',
  FACILITY_MANAGER: 'facilityManager',
  READ_ONLY: 'readOnly'
};

export const PERMISSIONS = {
  MANAGE_CLUB: 'manageClub',
  MANAGE_SEASON: 'manageSeason',
  MANAGE_TEAMS: 'manageTeams',
  MANAGE_PLAYERS: 'managePlayers',
  MANAGE_SCHEDULE: 'manageSchedule',
  MANAGE_COURTS: 'manageCourts',
  ENTER_SCORE: 'enterScore',
  APPROVE_SCORE: 'approveScore',
  MANAGE_PAYMENTS: 'managePayments',
  VIEW_REPORTS: 'viewReports',
  EXPORT_DATA: 'exportData',
  VIEW_ONLY: 'viewOnly'
};

const ROLE_PERMISSIONS = {
  [COMMERCIAL_ROLES.PLATFORM_OWNER]: Object.values(PERMISSIONS),
  [COMMERCIAL_ROLES.CLUB_OWNER]: Object.values(PERMISSIONS).filter(p => p !== PERMISSIONS.MANAGE_CLUB),
  [COMMERCIAL_ROLES.CLUB_ADMIN]: [PERMISSIONS.MANAGE_SEASON, PERMISSIONS.MANAGE_TEAMS, PERMISSIONS.MANAGE_PLAYERS, PERMISSIONS.MANAGE_SCHEDULE, PERMISSIONS.MANAGE_COURTS, PERMISSIONS.APPROVE_SCORE, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_DATA],
  [COMMERCIAL_ROLES.LEAGUE_DIRECTOR]: [PERMISSIONS.MANAGE_SEASON, PERMISSIONS.MANAGE_TEAMS, PERMISSIONS.MANAGE_PLAYERS, PERMISSIONS.MANAGE_SCHEDULE, PERMISSIONS.APPROVE_SCORE, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_DATA],
  [COMMERCIAL_ROLES.CAPTAIN]: [PERMISSIONS.ENTER_SCORE, PERMISSIONS.MANAGE_PLAYERS, PERMISSIONS.VIEW_REPORTS],
  [COMMERCIAL_ROLES.PLAYER]: [PERMISSIONS.ENTER_SCORE, PERMISSIONS.VIEW_ONLY],
  [COMMERCIAL_ROLES.FINANCE_ADMIN]: [PERMISSIONS.MANAGE_PAYMENTS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_DATA],
  [COMMERCIAL_ROLES.FACILITY_MANAGER]: [PERMISSIONS.MANAGE_COURTS, PERMISSIONS.MANAGE_SCHEDULE, PERMISSIONS.VIEW_REPORTS],
  [COMMERCIAL_ROLES.READ_ONLY]: [PERMISSIONS.VIEW_ONLY, PERMISSIONS.VIEW_REPORTS]
};

export function normalizePrincipal(principal = {}) {
  return {
    uid: principal.uid || principal.id || 'anonymous',
    role: principal.role || COMMERCIAL_ROLES.READ_ONLY,
    clubId: principal.clubId || '',
    seasonId: principal.seasonId || '',
    teamId: principal.teamId || ''
  };
}

export function hasPermission(principal, permission, resource = {}) {
  const user = normalizePrincipal(principal);
  const allowed = ROLE_PERMISSIONS[user.role] || [];
  if (!allowed.includes(permission)) return false;
  if (user.role === COMMERCIAL_ROLES.PLATFORM_OWNER) return true;
  if (resource.clubId && user.clubId && resource.clubId !== user.clubId) return false;
  if (resource.seasonId && user.seasonId && resource.seasonId !== user.seasonId) return false;
  if (resource.teamId && user.teamId && user.role === COMMERCIAL_ROLES.CAPTAIN && resource.teamId !== user.teamId) return false;
  return true;
}

export function requirePermission(principal, permission, resource = {}) {
  if (!hasPermission(principal, permission, resource)) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return true;
}
