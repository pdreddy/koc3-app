// Audit logging for important actions. Entries are written to PATHS.auditLog and
// are only viewable by SUPER_ADMIN (see Admin > Audit Log).

import { push, ref } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { roleOf } from '../config/roles';

export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  SCORE_ENTRY: 'score_entry',
  SCORE_EDIT: 'score_edit',
  SCORE_APPROVAL: 'score_approval',
  SCORE_REJECTION: 'score_rejection',
  PLAYER_ADD: 'player_add',
  PLAYER_EDIT: 'player_edit',
  PLAYER_DELETE: 'player_delete',
  TEAM_ADD: 'team_add',
  TEAM_EDIT: 'team_edit',
  TEAM_DELETE: 'team_delete',
  SCHEDULE_ADD: 'schedule_add',
  SCHEDULE_EDIT: 'schedule_edit',
  SCHEDULE_DELETE: 'schedule_delete',
  RATING_RECALCULATION: 'rating_recalculation',
  STANDINGS_RECALCULATION: 'standings_recalculation',
  ADMIN_ROLE_CHANGE: 'admin_role_change'
};

export const AUDIT_ACTION_LABELS = {
  login: 'Login',
  score_entry: 'Score entry',
  score_edit: 'Score edit',
  score_approval: 'Score approval',
  score_rejection: 'Score rejection',
  player_add: 'Player added',
  player_edit: 'Player edited',
  player_delete: 'Player deleted',
  team_add: 'Team added',
  team_edit: 'Team edited',
  team_delete: 'Team deleted',
  schedule_add: 'Schedule added',
  schedule_edit: 'Schedule edited',
  schedule_delete: 'Schedule deleted',
  rating_recalculation: 'Rating recalculation',
  standings_recalculation: 'Standings recalculation',
  admin_role_change: 'Admin role change'
};

// Firebase rejects `undefined`; sanitize to JSON-safe values (null when absent).
function sanitize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
}

function performerId(session) {
  return session?.username || session?.teamId || 'anonymous';
}

function performerName(session) {
  return session?.adminName || session?.teamName || 'Unknown';
}

// Write a single audit entry. Never throws — auditing must not break the action.
export async function logAudit(session, actionType, details = {}) {
  try {
    const entry = {
      actionType,
      performedByUserId: performerId(session),
      performedByName: performerName(session),
      performedByRole: roleOf(session),
      targetType: sanitize(details.targetType),
      targetId: sanitize(details.targetId),
      oldValue: sanitize(details.oldValue),
      newValue: sanitize(details.newValue),
      timestamp: Date.now()
    };
    await push(ref(db, PATHS.auditLog), entry);
  } catch (e) {
    // Logging is best-effort; surface to console but do not interrupt the user.
    console.error('Audit log failed', e);
  }
}
