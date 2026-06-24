import { buildMigrationPlan, buildTenantBase, buildTenantPaths, withTenantMetadata } from '../tenantPaths';

describe('tenant path model', () => {
  test('builds sanitized club and season paths', () => {
    const paths = buildTenantPaths({ clubId: 'My Club!', seasonId: 'Summer 2027' });
    expect(paths.teams).toBe('clubs/my_club/seasons/summer_2027/teams');
    expect(paths.adminUsers).toBe('clubs/my_club/adminUsers');
    expect(paths.settings).toBe('clubs/my_club/seasons/summer_2027/settings');
  });

  test('creates migration mappings from legacy koc_s3 paths', () => {
    const plan = buildMigrationPlan({ clubId: 'koc', seasonId: 'koc_s3' });
    expect(plan.find(item => item.key === 'matches')).toMatchObject({
      from: 'koc_s3/matches',
      to: 'clubs/koc/seasons/koc_s3/matches',
      strategy: 'copy-season-data'
    });
    expect(plan.find(item => item.key === 'adminUsers').strategy).toBe('copy-once-club-scope');
  });

  test('adds tenant metadata without overwriting existing record metadata', () => {
    expect(withTenantMetadata({ clubId: 'existing' }, { clubId: 'new', seasonId: 's1' })).toMatchObject({ clubId: 'existing', seasonId: 's1' });
  });

  test('returns normalized base identifiers', () => {
    expect(buildTenantBase({ clubId: 'KOC Club', seasonId: 'Season #4' })).toMatchObject({ clubId: 'koc_club', seasonId: 'season_4' });
  });
});
