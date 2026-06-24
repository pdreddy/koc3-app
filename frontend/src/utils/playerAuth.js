// Lightweight credential helpers for player self-registration.
//
// Passwords are hashed with SHA-256 (Web Crypto) before being stored, so the
// plaintext is never persisted. This is a meaningful improvement over the
// existing team-password storage (which is plaintext in RTDB) while keeping the
// same client-only, no-backend model. For a production auth system you'd move
// this to a real identity provider — the data-access seam makes that swappable.

import { playerIdFromName } from '../domain/model';

export { playerIdFromName };

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const pw = String(password || '');
  if (!pw) return '';
  return sha256Hex(`koc3:${pw}`);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  const candidate = await hashPassword(password);
  return candidate === hash;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// All roster player names across teams (the pool a person can "claim").
export function rosterPlayerNames(teams = {}) {
  const names = new Map();
  Object.values(teams || {}).forEach(team => {
    (team.players || []).forEach(p => {
      const name = String(p?.name || '').trim();
      if (!name) return;
      names.set(playerIdFromName(name), { name, teamId: team.id, teamName: team.name, abbreviation: team.abbreviation });
    });
  });
  return names;
}

export const MEMBERSHIP_TYPES = [
  { id: 'team', label: 'Under a team' },
  { id: 'individual', label: 'Individual player' },
  { id: 'club', label: 'Club member (no team yet)' }
];
