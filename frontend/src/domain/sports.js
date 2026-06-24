// Sport-agnostic core. A sport defines its disciplines, scoring units, line
// types and which rating systems make sense — so adding pickleball/padel later
// is configuration, not code. Tennis is the only sport defined today.

export const SPORTS = {
  tennis: {
    id: 'tennis',
    label: 'Tennis',
    disciplines: ['singles', 'doubles'],
    // Scoring units, smallest → largest, used by score entry/standings.
    scoringUnits: ['point', 'game', 'set', 'match'],
    ratingTypes: ['UTR', 'NTRP', 'CUSTOM', 'NONE'],
    defaultLineFormats: [
      { discipline: 'singles', bestOf: 3 },
      { discipline: 'doubles', bestOf: 3 }
    ]
  },
  pickleball: {
    id: 'pickleball',
    label: 'Pickleball',
    disciplines: ['singles', 'doubles', 'mixed'],
    scoringUnits: ['point', 'game', 'match'],
    ratingTypes: ['DUPR', 'CUSTOM', 'NONE'],
    defaultLineFormats: [
      { discipline: 'doubles', bestOf: 3 }
    ]
  }
};

export const DEFAULT_SPORT_ID = 'tennis';

export function getSport(sportId) {
  return SPORTS[sportId] || SPORTS[DEFAULT_SPORT_ID];
}

export function listSports() {
  return Object.values(SPORTS);
}
