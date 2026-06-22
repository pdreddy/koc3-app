export const ROLES = {
  GUEST: 'GUEST',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CAPTAIN: 'CAPTAIN'
};

export const LEGACY_ROLE_MAP = {
  guest: ROLES.GUEST,
  admin: ROLES.SUPER_ADMIN,
  team: ROLES.CAPTAIN
};

export function normalizeRole(role) {
  return LEGACY_ROLE_MAP[role] || role || ROLES.GUEST;
}

export function hasRole(session, allowedRoles) {
  const role = normalizeRole(session?.role);
  return allowedRoles.includes(role);
}

export function isAdminRole(session) {
  return hasRole(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
}

export function isCaptainRole(session) {
  return hasRole(session, [ROLES.CAPTAIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]);
}

export function canManageRoles(session) {
  return hasRole(session, [ROLES.SUPER_ADMIN]);
}

export function canViewAudit(session) {
  return hasRole(session, [ROLES.SUPER_ADMIN]);
}
