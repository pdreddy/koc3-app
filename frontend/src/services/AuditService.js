import { push, ref } from '../firebase';
import { db, PATHS } from '../firebase';
import { normalizeRole } from '../utils/roles';

export async function writeAuditLog({ actionType, session, targetType, targetId, oldValue = null, newValue = null }) {
  const now = Date.now();
  const role = normalizeRole(session?.role);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const record = {
    actionId: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    actionType,
    performedByUserId: session?.teamId || session?.userId || role,
    performedByName: session?.teamName || session?.name || role,
    performedByRole: role,
    targetType,
    targetId,
    oldValue,
    newValue,
    timestamp: now,
    ipAddress: 'client-unavailable',
    device: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
    browser: ua.slice(0, 240)
  };
  await push(ref(db, PATHS.auditLogs), record);
  return record;
}


export async function recordLineupAudit({ actionType, scheduleId, teamId, session, metadata = {}, oldValue = null }) {
  const now = Date.now();
  return writeAuditLog({
    actionType,
    session,
    targetType: 'lineup',
    targetId: `${scheduleId || 'unknown'}:${teamId || 'unknown'}`,
    oldValue,
    newValue: {
      scheduleId,
      teamId,
      actionTimestamp: now,
      lastUpdatedAt: metadata.lastUpdatedAt || now,
      ...metadata
    }
  });
}
