import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament } from '@/contexts/TournamentContext';
import type { Invite, TournamentPermission } from '@/types';
import { normalizeEmail } from '@/types';

export type ClaimStatus = 'idle' | 'checking' | 'claimed' | 'none' | 'error';

/**
 * Runs once per (signed-in user, tournament) pair: if the user has no permission doc yet
 * for this tournament, looks for a pending invite matching their email
 * (tournaments/{id}/invites/{normalizedEmail}) and, if found and unclaimed, self-creates
 * their permissions/{uid} doc and marks the invite claimed. This is what actually turns
 * "an admin invited captain@example.com as CAPTAIN of Team 3" into "captain@example.com
 * signs in and sees the captain screens" without any backend — see the matching
 * firestore.rules bootstrap exception on permissions/{userId} create and invites/{email}
 * update, which only allow this exact claim shape.
 *
 * Case-sensitivity caveat: the invite is keyed by normalizeEmail() (trim+lowercase) and
 * this hook looks up the same way, but the *security rule* compares against
 * request.auth.token.email as Firebase Auth returns it, which may not always be
 * lowercased. Not yet verified against a real deploy — see README.md.
 */
export function useClaimPendingInvite(): ClaimStatus {
  const { user } = useAuth();
  const { tournament, repo } = useTournament();
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || !user.email || !tournament || attempted.current) return;
    attempted.current = true;
    setStatus('checking');

    (async () => {
      try {
        const permissionRepo = repo<TournamentPermission>('permissions');
        const existing = await permissionRepo.get(user.uid);
        if (existing) {
          setStatus('none');
          return;
        }

        const inviteRepo = repo<Invite>('invites');
        const invite = await inviteRepo.get(normalizeEmail(user.email!));
        if (!invite || invite.claimedBy) {
          setStatus('none');
          return;
        }

        const now = Date.now();
        await permissionRepo.setWithId(user.uid, {
          userId: user.uid,
          tournamentId: tournament.id,
          role: invite.role,
          teamId: invite.teamId,
          grantedAt: now,
          grantedBy: invite.invitedBy,
        });
        await inviteRepo.update(invite.id, { claimedBy: user.uid, claimedAt: now });
        setStatus('claimed');
      } catch {
        setStatus('error');
      }
    })();
  }, [user, tournament, repo]);

  return status;
}
