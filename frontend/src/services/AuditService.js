import { push, ref } from 'firebase/database';
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
