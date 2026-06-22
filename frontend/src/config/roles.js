// Centralized role + permission model for KOC3 admin management.
//
// Three managed roles exist on top of the public "guest" view:
//   SUPER_ADMIN  – full access (e.g. damureddi)
//   ADMIN        – limited league operations (e.g. vinoda, umav)
//   CAPTAIN      – team-level access (team captains logging in with a team password)
//
// Permissions are enforced both in the UI (hide controls) and in code (guard
// the action itself) via the can() helper.

import { DEFAULT_ADMIN_PASSWORD } from '../data/initialTeams';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CAPTAIN: 'CAPTAIN',
  GUEST: 'GUEST'
};

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CAPTAIN: 'Captain',
  GUEST: 'Guest'
};

export const PERMISSIONS = {
  MANAGE_TEAMS: 'manage_teams',           // add/edit/delete teams
  MANAGE_PLAYERS: 'manage_players',       // add/edit/delete players
  MANAGE_SCHEDULE: 'manage_schedule',     // add/edit/delete fixtures
  ENTER_SCORE: 'enter_score',             // enter a match score
  EDIT_SCORE: 'edit_score',               // edit an existing score
  APPROVE_SCORE: 'approve_score',         // approve/reject disputed scores
  MANAGE_RATINGS: 'manage_ratings',       // PPRC name mapping / rating data
  MANAGE_STANDINGS: 'manage_standings',   // standings administration
  MANAGE_ADMINS: 'manage_admins',         // manage admins and captains
  VIEW_AUDIT: 'view_audit',               // view the audit log
  DELETE_CORE_DATA: 'delete_core_data',   // delete teams/fixtures/results
  SUBMIT_LINEUP: 'submit_lineup',         // captain lineup submission
  VIEW_DATA: 'view_data'                  // teams, players, standings, ratings, history
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.ADMIN]: [
    PERMISSIONS.MANAGE_SCHEDULE,
    PERMISSIONS.ENTER_SCORE,
    PERMISSIONS.EDIT_SCORE,
    PERMISSIONS.APPROVE_SCORE,
    PERMISSIONS.VIEW_DATA
  ],
  [ROLES.CAPTAIN]: [
    PERMISSIONS.SUBMIT_LINEUP,
    PERMISSIONS.ENTER_SCORE,
    PERMISSIONS.APPROVE_SCORE,
    PERMISSIONS.VIEW_DATA
  ],
  [ROLES.GUEST]: [
    PERMISSIONS.VIEW_DATA
  ]
};

// Derive the canonical role from a stored auth session.
export function roleOf(session) {
  if (!session) return ROLES.GUEST;
  if (session.role === 'admin') {
    return ROLE_PERMISSIONS[session.adminRole] ? session.adminRole : ROLES.ADMIN;
  }
  if (session.role === 'team') return ROLES.CAPTAIN;
  return ROLES.GUEST;
}

// Permission check. Accepts either a role string or a session object.
export function can(roleOrSession, permission) {
  const role = typeof roleOrSession === 'string' ? roleOrSession : roleOf(roleOrSession);
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export function isAdminRole(role) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

// Default admin user accounts. Seeded into Firebase on first run; afterwards the
// live database copy is authoritative so a SUPER_ADMIN can manage accounts.
export const DEFAULT_ADMIN_USERS = {
  damureddi: { name: 'Damu Reddy', role: ROLES.SUPER_ADMIN, password: DEFAULT_ADMIN_PASSWORD },
  vinoda: { name: 'Vinoda', role: ROLES.ADMIN, password: 'KOCVinoda#3' },
  umav: { name: 'Uma V', role: ROLES.ADMIN, password: 'KOCUmav#3' }
};
