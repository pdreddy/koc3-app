import { push, ref } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { normalizeRole } from './roles';

function deviceInfo() {
  if (typeof navigator === 'undefined') return { browser: 'unknown', device: 'unknown' };
  return {
    browser: navigator.userAgent || 'unknown',
    device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'mobile' : 'desktop'
  };
}

export async function logAuditEvent({ actionType, session = {}, targetType = '', targetId = '', oldValue = null, newValue = null }) {
  try {
    const { browser, device } = deviceInfo();
    const entry = {
      actionType,
      performedByUserId: session.userId || session.teamId || normalizeRole(session.role),
      performedByName: session.teamName || session.name || normalizeRole(session.role),
      performedByRole: normalizeRole(session.role),
      targetType,
      targetId,
      oldValue,
      newValue,
      timestamp: Date.now(),
      ipAddress: 'client',
      device,
      browser
    };
    const auditRef = await push(ref(db, PATHS.auditLogs), entry);
    return auditRef.key;
  } catch (error) {
    console.warn('Audit log failed', error);
    return null;
  }
}
