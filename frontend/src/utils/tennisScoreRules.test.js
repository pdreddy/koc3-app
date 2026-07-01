import { regularSetWinner, isValidTiebreakScore, validateLineScore, SCORE_ERRORS, DEFAULT_MATCH_FORMAT, buildScoreErrors } from './tennisScoreRules';

describe('SCORE_ERRORS — must stay byte-identical for the default (KOC) format', () => {
  test('matches the exact strings hardcoded before the config-driven generalization', () => {
    expect(SCORE_ERRORS).toEqual({
      regularSet: 'Only 4-0, 4-1, 4-2 or 4-3 are valid set scores.',
      tieRequired: '4-3 requires a tiebreak score.',
      tieInvalid: 'Tiebreak winner must reach 7 points and win by 2.',
      matchTieInvalid: 'Match tiebreak winner must reach 10 points and win by 2.',
      singlesSets: 'Singles winner must win 3 sets.',
      doublesSets: 'Doubles winner must win 2 sets.',
      doublesThird: 'Third set in doubles must be a 10-point match tiebreak.'
    });
  });
});

describe('regularSetWinner', () => {
  test('4-x wins for team1 (x <= 3)', () => {
    expect(regularSetWinner(4, 0)).toBe(1);
    expect(regularSetWinner(4, 3)).toBe(1);
  });
  test('x-4 wins for team2 (x <= 3)', () => {
    expect(regularSetWinner(0, 4)).toBe(2);
    expect(regularSetWinner(3, 4)).toBe(2);
  });
  test('4-4 or non-set scores are not a winner', () => {
    expect(regularSetWinner(4, 4)).toBeNull();
    expect(regularSetWinner(5, 3)).toBeNull();
    expect(regularSetWinner(2, 1)).toBeNull();
  });
  test('honors a custom gamesPerSet', () => {
    expect(regularSetWinner(6, 4, 6)).toBe(1);
    expect(regularSetWinner(6, 4)).toBeNull(); // default gamesPerSet=4, 6 isn't a valid winning score
  });
});

describe('isValidTiebreakScore', () => {
  test('winner must reach minPoints and win by 2 (default winBy)', () => {
    expect(isValidTiebreakScore(7, 5, 7)).toBe(true);
    expect(isValidTiebreakScore(9, 7, 7)).toBe(true);
    expect(isValidTiebreakScore(7, 6, 7)).toBe(false); // win by only 1
    expect(isValidTiebreakScore(6, 4, 7)).toBe(false); // didn't reach minPoints
  });
  test('honors a custom winBy', () => {
    expect(isValidTiebreakScore(8, 7, 7, 1)).toBe(true);
  });
});

describe('validateLineScore — default (KOC) format', () => {
  test('valid singles 3-0 win', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 1 }, { team1: 4, team2: 2 }, { team1: 4, team2: 0 },
    ] };
    expect(validateLineScore(line)).toEqual([]);
  });

  test('incomplete singles (only 2 sets won) is invalid', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 1 }, { team1: 4, team2: 2 },
    ] };
    expect(validateLineScore(line)).toEqual([`Singles: ${SCORE_ERRORS.singlesSets}`]);
  });

  test('valid doubles 2-0 win, no third set needed', () => {
    const line = { label: 'Doubles 1', type: 'doubles', sets: [
      { team1: 4, team2: 2 }, { team1: 4, team2: 1 },
    ] };
    expect(validateLineScore(line)).toEqual([]);
  });

  test('doubles split with no third set is invalid (missing tiebreak AND incomplete)', () => {
    const line = { label: 'Doubles 1', type: 'doubles', sets: [
      { team1: 4, team2: 2 }, { team1: 1, team2: 4 },
    ] };
    // 1-1 split with no decisive third set fails both checks: the required match-tiebreak
    // third set is missing, and (as a knock-on effect) neither side has reached setsToWin.
    expect(validateLineScore(line)).toEqual([
      `Doubles 1: ${SCORE_ERRORS.doublesThird}`,
      `Doubles 1: ${SCORE_ERRORS.doublesSets}`,
    ]);
  });

  test('valid doubles split with a correct 10-point match tiebreak third set', () => {
    const line = { label: 'Doubles 1', type: 'doubles', sets: [
      { team1: 4, team2: 2 },
      { team1: 1, team2: 4 },
      { team1: 1, team2: 0, matchTieBreak: { team1: 10, team2: 5 } },
    ] };
    expect(validateLineScore(line)).toEqual([]);
  });

  test('extra unnecessary third set when not split is invalid', () => {
    const line = { label: 'Doubles 1', type: 'doubles', sets: [
      { team1: 4, team2: 2 }, { team1: 4, team2: 1 }, { team1: 1, team2: 0 },
    ] };
    // The stray third set is itself not a valid set score, plus doubles doesn't allow a
    // third set at all once the match is already decided 2-0 in the first two sets.
    expect(validateLineScore(line)).toEqual([
      `Doubles 1: ${SCORE_ERRORS.regularSet}`,
      `Doubles 1: ${SCORE_ERRORS.doublesThird}`,
    ]);
  });

  test('4-3 set requires a tiebreak score', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 3 }, { team1: 4, team2: 1 }, { team1: 4, team2: 2 },
    ] };
    expect(validateLineScore(line)).toEqual([`Singles: ${SCORE_ERRORS.tieRequired}`]);
  });

  test('valid 4-3 set with a correct 7-point tiebreak', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 3, tieBreak: { team1: 7, team2: 5 } },
      { team1: 4, team2: 1 },
      { team1: 4, team2: 2 },
    ] };
    expect(validateLineScore(line)).toEqual([]);
  });

  test('invalid tiebreak score (win by only 1) is rejected', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 3, tieBreak: { team1: 7, team2: 6 } },
      { team1: 4, team2: 1 },
      { team1: 4, team2: 2 },
    ] };
    expect(validateLineScore(line)).toEqual([`Singles: ${SCORE_ERRORS.tieInvalid}`]);
  });
});

describe('validateLineScore — custom LeagueConfig match format', () => {
  const sixGameBestOf3 = {
    singles: { gamesPerSet: 6, setsToWin: 2, setTiebreak: { minPoints: 7, winBy: 2 } },
    doubles: { gamesPerSet: 6, setsToWin: 2, setTiebreak: { minPoints: 7, winBy: 2 }, matchTiebreak: { minPoints: 10, winBy: 2 } },
  };

  test('a 6-game best-of-3 singles format validates a 2-0 win', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 6, team2: 3 }, { team1: 6, team2: 4 },
    ] };
    expect(validateLineScore(line, sixGameBestOf3)).toEqual([]);
  });

  test('the same 4-game score is invalid under a 6-game format', () => {
    const line = { label: 'Singles', type: 'singles', sets: [
      { team1: 4, team2: 1 }, { team1: 4, team2: 2 }, { team1: 4, team2: 0 },
    ] };
    const errors = validateLineScore(line, sixGameBestOf3);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('error message text reflects the custom format', () => {
    const errors = buildScoreErrors(sixGameBestOf3);
    expect(errors.regularSet).toBe('Only 6-0, 6-1, 6-2, 6-3, 6-4 or 6-5 are valid set scores.');
    expect(errors.singlesSets).toBe('Singles winner must win 2 sets.');
  });

  test('DEFAULT_MATCH_FORMAT documents KOC\'s exact current rules', () => {
    expect(DEFAULT_MATCH_FORMAT).toEqual({
      singles: { gamesPerSet: 4, setsToWin: 3, setTiebreak: { minPoints: 7, winBy: 2 } },
      doubles: { gamesPerSet: 4, setsToWin: 2, setTiebreak: { minPoints: 7, winBy: 2 }, matchTiebreak: { minPoints: 10, winBy: 2 } },
    });
  });
});
