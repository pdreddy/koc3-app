import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/firebase/config';
import { identityConverter } from './firestoreConverters';
import type { SuperAdminInvite, SuperAdminRecord } from '@/types';
import { normalizeEmail } from '@/types';

// Mirror of firestore.rules' isBootstrapSuperAdminEmail() — the only way the very first
// platform super admin can ever come into existence, since every other create path on
// superAdmins/{uid} requires isSuperAdmin() to already be true. Keep these two lists in
// sync by hand; there is no shared source between a security rules file and TS source.
const BOOTSTRAP_SUPER_ADMIN_EMAILS = ['damu.palavali@gmail.com'];

const superAdminsCollection = collection(db, 'superAdmins').withConverter(identityConverter<SuperAdminRecord>());
const superAdminInvitesCollection = collection(db, 'superAdminInvites').withConverter(identityConverter<SuperAdminInvite>());

export const SuperAdminService = {
  async get(uid: string): Promise<SuperAdminRecord | null> {
    const snap = await getDoc(doc(superAdminsCollection, uid));
    return snap.exists() ? snap.data() : null;
  },

  async list(): Promise<SuperAdminRecord[]> {
    const snap = await getDocs(superAdminsCollection);
    return snap.docs.map((d) => d.data());
  },

  async listInvites(): Promise<SuperAdminInvite[]> {
    const snap = await getDocs(superAdminInvitesCollection);
    return snap.docs.map((d) => d.data());
  },

  async invite(email: string, invitedBy: string): Promise<SuperAdminInvite> {
    const normalized = normalizeEmail(email);
    const now = Date.now();
    const invite: SuperAdminInvite = {
      id: normalized,
      email: normalized,
      invitedBy,
      invitedAt: now,
      claimedBy: null,
      claimedAt: null,
    };
    await setDoc(doc(superAdminInvitesCollection, normalized), invite);
    return invite;
  },

  /** Revokes an existing super admin (deletes their superAdmins/{uid} doc) and, if an
   * invite doc for their email still exists, deletes that too so it can't be re-claimed. */
  async revoke(record: SuperAdminRecord): Promise<void> {
    await deleteDoc(doc(superAdminsCollection, record.uid));
    if (record.email) {
      const inviteRef = doc(superAdminInvitesCollection, normalizeEmail(record.email));
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists()) await deleteDoc(inviteRef);
    }
  },

  async cancelInvite(email: string): Promise<void> {
    await deleteDoc(doc(superAdminInvitesCollection, normalizeEmail(email)));
  },

  /**
   * Runs once per signed-in session (see contexts/SuperAdminContext.tsx): if the user
   * already has a superAdmins/{uid} doc, they're done. Otherwise looks for a pending
   * superAdminInvites/{email} doc matching their email and self-claims it, exactly like
   * the per-tournament invite claim (hooks/useClaimPendingInvite.ts). Failing that, checks
   * the hardcoded bootstrap allowlist above — this only ever fires for those specific
   * emails, so it produces no permission-denied noise for ordinary users.
   * Returns whether the caller is (now) a super admin.
   */
  async attemptClaim(user: User): Promise<boolean> {
    const existing = await this.get(user.uid);
    if (existing) return true;
    if (!user.email) return false;
    const normalized = normalizeEmail(user.email);

    const inviteRef = doc(superAdminInvitesCollection, normalized);
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists() && inviteSnap.data().claimedBy == null) {
      const now = Date.now();
      await setDoc(doc(superAdminsCollection, user.uid), {
        id: user.uid,
        uid: user.uid,
        email: user.email,
        grantedAt: now,
        grantedBy: inviteSnap.data().invitedBy,
      });
      await updateDoc(inviteRef, { claimedBy: user.uid, claimedAt: now });
      return true;
    }

    if (BOOTSTRAP_SUPER_ADMIN_EMAILS.includes(normalized)) {
      const now = Date.now();
      await setDoc(doc(superAdminsCollection, user.uid), {
        id: user.uid,
        uid: user.uid,
        email: user.email,
        grantedAt: now,
        grantedBy: user.uid,
      });
      return true;
    }

    return false;
  },
};
