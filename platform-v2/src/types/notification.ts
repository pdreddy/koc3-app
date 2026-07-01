import type { EpochMillis } from './common';

export type NotificationType =
  | 'SCORE_SUBMITTED' | 'SCORE_APPROVED' | 'SCORE_REJECTED' | 'PLAYOFFS_GENERATED' | 'ANNOUNCEMENT';

// tournaments/{tournamentId}/notifications/{id} — a broadcast board, not a personal inbox:
// `audience` targets a whole role/team rather than one uid, because the writer (often a
// captain submitting a score, notifying admins) usually can't enumerate individual admin
// uids — permissions/{uid} docs for OTHER users are only readable by admins (see
// firestore.rules), so per-recipient fan-out isn't possible client-side without a backend.
// There is deliberately no per-user `read` field for the same reason (one shared doc, many
// recipients); "seen" state is tracked client-side in localStorage instead — see
// hooks/useNotifications.ts.
export type NotificationAudience =
  | 'ALL' // every signed-in user with any role in the tournament
  | 'ADMIN' // TOURNAMENT_ADMIN / ORGANIZER
  | `TEAM_${string}`; // captain/vice-captain/player of that team

export interface AppNotification {
  id: string;
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null; // absolute app path, e.g. "/admin/tournaments/{id}/approve-scores" or "/t/{slug}/playoffs"
  createdBy: string;
  createdAt: EpochMillis;
}
