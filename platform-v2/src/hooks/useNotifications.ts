import { useEffect, useState } from 'react';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTournamentRole } from './useTournamentRole';
import { isNotificationFor } from '@/services/notificationService';
import type { AppNotification } from '@/types';

function lastSeenKey(tournamentId: string, uid: string): string {
  return `notif-last-seen:${tournamentId}:${uid}`;
}

/**
 * Loads every notification visible to the signed-in user's role/team in this tournament
 * (see types/notification.ts for why there's no per-user Firestore `read` field) and
 * compares against a per-(tournament,user) "last seen" timestamp kept in localStorage to
 * derive an unread count for the bell icon. markSeen() bumps that timestamp to now.
 */
export function useNotifications() {
  const { tournament, repo } = useTournament();
  const { user } = useAuth();
  const { role, teamId, loading: roleLoading } = useTournamentRole();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament || roleLoading || !role) { setLoading(false); return; }
    repo<AppNotification>('notifications').list().then((items) => {
      const visible = items.filter((n) => isNotificationFor(n, role, teamId)).sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(visible);
      setLoading(false);
    });
  }, [tournament, repo, role, teamId, roleLoading]);

  useEffect(() => {
    if (!tournament || !user) return;
    setLastSeen(Number(localStorage.getItem(lastSeenKey(tournament.id, user.uid)) ?? 0));
  }, [tournament, user]);

  const unreadCount = notifications.filter((n) => n.createdAt > lastSeen).length;

  const markSeen = () => {
    if (!tournament || !user) return;
    const now = Date.now();
    localStorage.setItem(lastSeenKey(tournament.id, user.uid), String(now));
    setLastSeen(now);
  };

  return { notifications, unreadCount, loading, markSeen };
}
