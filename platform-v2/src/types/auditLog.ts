export type AuditActionType =
  | 'TOURNAMENT_CREATED' | 'TOURNAMENT_PUBLISHED' | 'TOURNAMENT_ARCHIVED'
  | 'CONFIG_UPDATED' | 'PLAYERS_IMPORTED' | 'TEAMS_GENERATED' | 'SCHEDULE_GENERATED'
  | 'ROLE_INVITED' | 'ROLE_CLAIMED' | 'ROLE_REVOKED' | 'INVITE_CANCELLED' | 'LINEUP_LOCKED'
  | 'SCORE_SAVED' | 'SCORE_APPROVED' | 'SCORE_REJECTED' | 'PLAYOFFS_GENERATED';

export interface AuditLog {
  id: string;
  tournamentId: string;
  actionType: AuditActionType;
  performedByUserId: string;
  performedByEmail: string | null;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}
