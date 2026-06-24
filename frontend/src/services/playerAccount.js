// Player account service — lightweight, database-backed player credentials.
//
// Player accounts are profiles stored in RTDB (koc_s3/players) with a SHA-256
// password hash, consistent with the app's existing client-only model (team and
// admin passwords already live in the database). This is intentionally NOT
// Firebase Authentication; it sits behind a small service boundary so it can be
// upgraded to a real identity provider later without touching the UI.

import { playersRepo } from '../data/dataAccess';
import { hashPassword, verifyPassword, playerIdFromName } from '../utils/playerAuth';

function findByEmail(players, email) {
  const target = String(email || '').trim().toLowerCase();
  const entry = Object.entries(players || {}).find(([, rec]) => String(rec?.email || '').trim().toLowerCase() === target);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

// Create (or claim) a player profile with a password. `players` is the current
// in-memory snapshot used to detect duplicates client-side.
export async function registerPlayer({ players, name, email, phone, teamId, membershipType, password }) {
  const playerId = playerIdFromName(name);
  if (players?.[playerId]?.passwordHash) {
    throw new Error('This player is already registered. Use Sign In or ask an organizer to reset your password.');
  }
  if (findByEmail(players, email) && findByEmail(players, email).id !== playerId) {
    throw new Error('That email is already registered to another player.');
  }
  const passwordHash = await hashPassword(password);
  const record = {
    id: playerId,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone || '').trim(),
    membershipType: teamId ? 'team' : (membershipType || 'individual'),
    teamId: teamId || '',
    passwordHash,
    claimed: true,
    createdAt: players?.[playerId]?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  await playersRepo().upsert(playerId, record);
  return record;
}

export async function signInPlayer({ players, email, password }) {
  const record = findByEmail(players, email);
  if (!record || !record.passwordHash) throw new Error('No account found for that email.');
  if (!(await verifyPassword(password, record.passwordHash))) throw new Error('Incorrect email or password.');
  return record;
}

export async function changePlayerPassword(playerId, newPassword) {
  const passwordHash = await hashPassword(newPassword);
  await playersRepo().upsert(playerId, { passwordHash, updatedAt: Date.now() });
}

// Admin-initiated reset: set a temporary password for a player profile.
export async function adminResetPlayerPassword(playerId, tempPassword) {
  const passwordHash = await hashPassword(tempPassword);
  await playersRepo().upsert(playerId, { passwordHash, updatedAt: Date.now() });
}
