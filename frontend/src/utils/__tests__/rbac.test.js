import { COMMERCIAL_ROLES, PERMISSIONS, hasPermission, requirePermission } from '../rbac';

describe('commercial RBAC', () => {
  test('platform owner can access any tenant', () => {
    expect(hasPermission({ role: COMMERCIAL_ROLES.PLATFORM_OWNER }, PERMISSIONS.MANAGE_PAYMENTS, { clubId: 'other' })).toBe(true);
  });

  test('club admin is denied outside their club', () => {
    expect(hasPermission({ role: COMMERCIAL_ROLES.CLUB_ADMIN, clubId: 'a' }, PERMISSIONS.MANAGE_TEAMS, { clubId: 'b' })).toBe(false);
  });

  test('captain can manage own team only', () => {
    const captain = { role: COMMERCIAL_ROLES.CAPTAIN, clubId: 'c1', seasonId: 's1', teamId: 't1' };
    expect(hasPermission(captain, PERMISSIONS.MANAGE_PLAYERS, { clubId: 'c1', seasonId: 's1', teamId: 't1' })).toBe(true);
    expect(hasPermission(captain, PERMISSIONS.MANAGE_PLAYERS, { clubId: 'c1', seasonId: 's1', teamId: 't2' })).toBe(false);
  });

  test('requirePermission throws on denial', () => {
    expect(() => requirePermission({ role: COMMERCIAL_ROLES.READ_ONLY }, PERMISSIONS.MANAGE_PAYMENTS)).toThrow('Permission denied');
  });
});
