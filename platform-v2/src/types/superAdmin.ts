// superAdmins/{uid} — platform-wide, NOT scoped to any tournament. Presence of this doc
// (keyed by the user's own uid) is what firestore.rules' isSuperAdmin() checks, and every
// per-tournament role function (hasRole/isTournamentAdmin/isCaptainOfTeam) already ORs
// against it, so a super admin transparently gets admin access to every tournament without
// needing a permissions/{uid} doc in each one.
export interface SuperAdminRecord {
  id: string; // == uid, same as the doc id
  uid: string;
  email: string | null;
  grantedAt: number;
  grantedBy: string; // uid of the super admin who invited them, or their own uid for a bootstrap self-claim
}

// superAdminInvites/{normalizedEmail} — same claim-on-login shape as the per-tournament
// Invite type (see types/invite.ts), just platform-wide and role-less (every super admin
// invite grants the same, single SUPER_ADMIN capability).
export interface SuperAdminInvite {
  id: string; // == normalized email
  email: string;
  invitedBy: string;
  invitedAt: number;
  claimedBy: string | null;
  claimedAt: number | null;
}
