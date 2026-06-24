import { buildConfigurableTeams, buildPlaceholderPlayer, buildTournamentConfig, playerLookupRows } from '../teamSetup';

describe('team setup wizard helpers', () => {
  test('builds requested team and player counts for KOC', () => {
    const teams = buildConfigurableTeams({ clubKey: 'koc', teamCount: 3, playersPerTeam: 4, groupsCount: 2 });
    expect(Object.keys(teams)).toHaveLength(3);
    expect(teams.team1.players).toHaveLength(4);
    expect(teams.team1.abbreviation).toBe('KOC1');
    expect(teams.team3.group).toBe('A');
  });

  test('supports Triace preset and manual player names', () => {
    const teams = buildConfigurableTeams({ clubKey: 'triace', teamCount: 1, playersPerTeam: 2, playerNamesByTeam: [['Alice', 'Bob']] });
    expect(teams.team1.name).toBe('Triace Team 1');
    expect(teams.team1.abbreviation).toBe('TRI1');
    expect(teams.team1.players.map(player => player.name)).toEqual(['Alice', 'Bob']);
  });

  test('looks up player ratings from database rows', () => {
    const lookupRows = [{ fullName: 'Alice Player', utr: 7.25 }];
    expect(buildPlaceholderPlayer(0, 0, ['Alice Player'], lookupRows)).toMatchObject({ name: 'Alice Player', utr: 7.25 });
  });

  test('converts Firebase player ratings into lookup rows', () => {
    expect(playerLookupRows({ p1: { fullName: 'A' } })).toEqual([{ id: 'p1', fullName: 'A' }]);
  });
});


describe('tournament setup configuration', () => {
  test('builds mini-set no-ad tournament defaults', () => {
    const config = buildTournamentConfig({ clubKey: 'koc', tournamentName: 'KOC Mini', gameFormat: 'miniSet4', teamCount: 8, playersPerTeam: 7, minPlaysPerPlayer: 2, maxPlaysPerPlayer: 6 });
    expect(config.leagueConfig).toMatchObject({ leagueName: 'KOC Mini', teamCount: 8, maxPlayersPerTeam: 7, gameStyle: 'Mini Set (4 games)' });
    expect(config.scoringConfig.templates[0]).toMatchObject({ gamesPerSet: 4, noAd: true, setCount: 3 });
    expect(config.eligibilityRules).toMatchObject({ minMatchDays: 2, maxTotalMatchDays: 6 });
  });

  test('builds regular and pro-set formats with configurable ad scoring', () => {
    expect(buildTournamentConfig({ gameFormat: 'regular6' }).scoringConfig.templates[0]).toMatchObject({ gamesPerSet: 6, noAd: false });
    expect(buildTournamentConfig({ gameFormat: 'proSet8', noAd: true }).scoringConfig.templates[0]).toMatchObject({ gamesPerSet: 8, setCount: 1, noAd: true });
  });
});
