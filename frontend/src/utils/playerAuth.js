// Helpers for player self-registration. Passwords are handled by Firebase
// Authentication (see services/playerAccount.js); this module only covers
// validation, roster discovery and the persistent player identity helper.

import { playerIdFromName } from '../domain/model';

export { playerIdFromName };

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
