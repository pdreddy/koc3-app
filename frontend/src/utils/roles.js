export const ROLES = {
  GUEST: 'GUEST',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CAPTAIN: 'CAPTAIN'
};

export function normalizeRole(role) {
  if (role === 'admin') return ROLES.ADMIN;
  if (role === 'team') return ROLES.CAPTAIN;
  if (role === 'super_admin') return ROLES.SUPER_ADMIN;
  return role || ROLES.GUEST;
}

export function hasRole(session, allowed = []) {
  const role = normalizeRole(session?.role);
  return allowed.includes(role);
}

export function isAdminRole(session) {
  return hasRole(session, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
}

export function isCaptainRole(session) {
  return hasRole(session, [ROLES.CAPTAIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]);
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === ROLES.SUPER_ADMIN) return 'SUPER ADMIN';
  if (normalized === ROLES.ADMIN) return 'ADMIN';
  if (normalized === ROLES.CAPTAIN) return 'CAPTAIN';
  return 'GUEST';
}
