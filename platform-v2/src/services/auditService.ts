import type { AuditActionType, AuditLog } from '@/types';
import { tournamentRepository } from './TournamentRepository';

export interface AuditActor {
  uid: string;
  email: string | null;
}

/** Writes one audit log entry. Takes a tournamentId directly (rather than requiring a
 * TournamentContext) so it can be called from services like TournamentService that run
 * outside a mounted TournamentProvider (e.g. right after creating a tournament). */
export async function writeAuditLog(
  tournamentId: string,
  actionType: AuditActionType,
  actor: AuditActor,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const repo = tournamentRepository<AuditLog>(tournamentId, 'auditLogs');
  await repo.create({
    tournamentId,
    actionType,
    performedByUserId: actor.uid,
    performedByEmail: actor.email,
    targetType,
    targetId,
    metadata,
    timestamp: Date.now(),
  });
}
