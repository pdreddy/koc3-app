// Extensible capability map — the single source of truth for "who can do what",
// instead of scattered role checks. Add a capability here and grant it to roles;
// components ask `can(session, CAP.x)` rather than re-deriving role logic.
//
// Built on top of the existing ROLES/normalizeRole so all current behavior is
// preserved; this is an additive, more declarative layer.

import { ROLES, normalizeRole } from './roles';

export const CAP = {
  VIEW_PUBLIC: 'view_public',
  ENTER_SCORE: 'enter_score',
  MANAGE_OWN_ROSTER: 'manage_own_roster',
  EDIT_TEAMS: 'edit_teams',
  EDIT_SCHEDULE: 'edit_schedule',
  EDIT_CONFIG: 'edit_config',
  MANAGE_ROLES: 'manage_roles',
  VIEW_AUDIT: 'view_audit',
  RUN_PLAYOFFS: 'run_playoffs',
  MANAGE_OWN_PROFILE: 'manage_own_profile',
  APPROVE_REGISTRATIONS: 'approve_registrations'
};

// Role → capabilities. Higher roles inherit by listing what they can do.
const ROLE_CAPABILITIES = {
  [ROLES.GUEST]: [CAP.VIEW_PUBLIC],
  [ROLES.PLAYER]: [CAP.VIEW_PUBLIC, CAP.MANAGE_OWN_PROFILE],
  [ROLES.CAPTAIN]: [CAP.VIEW_PUBLIC, CAP.ENTER_SCORE, CAP.MANAGE_OWN_ROSTER, CAP.MANAGE_OWN_PROFILE],
  [ROLES.ADMIN]: [
    CAP.VIEW_PUBLIC, CAP.ENTER_SCORE, CAP.MANAGE_OWN_ROSTER, CAP.MANAGE_OWN_PROFILE,
    CAP.EDIT_TEAMS, CAP.EDIT_SCHEDULE, CAP.EDIT_CONFIG, CAP.RUN_PLAYOFFS, CAP.APPROVE_REGISTRATIONS
  ],
  [ROLES.SUPER_ADMIN]: [
    CAP.VIEW_PUBLIC, CAP.ENTER_SCORE, CAP.MANAGE_OWN_ROSTER, CAP.MANAGE_OWN_PROFILE,
    CAP.EDIT_TEAMS, CAP.EDIT_SCHEDULE, CAP.EDIT_CONFIG, CAP.RUN_PLAYOFFS, CAP.APPROVE_REGISTRATIONS,
    CAP.MANAGE_ROLES, CAP.VIEW_AUDIT
  ]
};

export function capabilitiesFor(session) {
  const role = normalizeRole(session?.role);
  return ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES[ROLES.GUEST];
}

export function can(session, capability) {
  return capabilitiesFor(session).includes(capability);
}

// Allow runtime extension (e.g. a future custom role from config).
export function grant(role, capability) {
  if (!ROLE_CAPABILITIES[role]) ROLE_CAPABILITIES[role] = [];
  if (!ROLE_CAPABILITIES[role].includes(capability)) ROLE_CAPABILITIES[role].push(capability);
}
