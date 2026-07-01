import type { TournamentScopedRepository } from './TournamentRepository';
import type { AppNotification, NotificationAudience, NotificationType, Role } from '@/types';

type Repo = <T extends { id: string }>(subcollection: 'notifications') => TournamentScopedRepository<T>;

export async function notify(
  repo: Repo,
  audience: NotificationAudience,
  type: NotificationType,
  title: string,
  body: string,
  link: string | null,
  createdBy: string
): Promise<void> {
  await repo<AppNotification>('notifications').create({
    audience, type, title, body, link, createdBy, createdAt: Date.now(),
  });
}

/** Client-side filter mirroring firestore.rules' notifications read rule — a plain list()
 * already only returns docs the rules let this user read, but a subscribeAll() caller (or
 * anything reading before role/teamId are known) still needs to re-derive "is this actually
 * for me" locally. */
export function isNotificationFor(n: AppNotification, role: Role | null, teamId: string | null): boolean {
  if (n.audience === 'ALL') return Boolean(role);
  if (n.audience === 'ADMIN') return role === 'TOURNAMENT_ADMIN' || role === 'ORGANIZER';
  return teamId != null && n.audience === `TEAM_${teamId}`;
}
