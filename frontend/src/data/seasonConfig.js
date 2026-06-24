// Central, config-driven season definition for the club platform.
//
// Everything that used to be hardcoded (team count, squad size, rating tiers,
// format, rules, scoring, playoffs) lives here as a single editable object that
// is persisted to Firebase. DEFAULT_CONFIG reproduces the current KOC3 season so
// the app runs out-of-the-box if an organizer changes nothing.

export const CONFIG_SCHEMA_VERSION = 1;

export const RATING_TYPES = ['UTR', 'NTRP', 'CUSTOM', 'NONE'];
export const FORMAT_TYPES = ['round_robin', 'knockout', 'groups_playoffs', 'ladder', 'swiss'];
export const ROSTER_ASSIGNMENT_MODES = ['admin', 'captain_pick'];

// Tiebreak keys that the standings engine knows how to compute.
export const TIEBREAK_KEYS = {
  points: 'Team Points',
  sets: 'Sets Won',
  singlesWins: 'Singles Wins',
  headToHead: 'Head-to-Head',
  games: 'Games Difference'
};

// The seven UTR bands currently used to balance each squad (3.0 → 6.0).
function defaultUtrTiers() {
  return [
    { id: 'tier_30', label: '3.0', min: 0, max: 3.24 },
    { id: 'tier_35', label: '3.5', min: 3.25, max: 3.74 },
    { id: 'tier_40', label: '4.0', min: 3.75, max: 4.24 },
    { id: 'tier_45', label: '4.5', min: 4.25, max: 4.74 },
    { id: 'tier_50', label: '5.0', min: 4.75, max: 5.24 },
    { id: 'tier_55', label: '5.5', min: 5.25, max: 5.74 },
    { id: 'tier_60', label: '6.0+', min: 5.75, max: 16.5 }
  ];
}

export const DEFAULT_CONFIG = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  seasonId: 'koc3',
  club: {
    name: 'KOC3',
    tagline: 'Tennis League',
    seasonName: 'KOC3 / PPRC Tennis',
    logoEmoji: '🏆',
    logoUrl: '',
    primaryColor: '#2563eb',
    accentColor: '#0ea5e9',
    publicViewEnabled: true,
    publicViewNote: 'All league schedules are visible without login.'
  },
  teams: {
    count: 16,
    minSquad: 7,
    maxSquad: 7
  },
  rating: {
    type: 'UTR',
    label: 'UTR',
    min: 1,
    max: 16.5,
    tiers: defaultUtrTiers()
  },
  format: {
    type: 'groups_playoffs',
    groups: [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' }
    ],
    linesPerTie: 4,
    singlesLines: 2,
    doublesLines: 2,
    lineFormats: [
      { id: 'l1', label: 'Line 1', discipline: 'singles', bestOf: 3, noAd: false, miniSets: true, finalSetTiebreak: false },
      { id: 'l2', label: 'Line 2', discipline: 'singles', bestOf: 3, noAd: false, miniSets: true, finalSetTiebreak: false },
      { id: 'l3', label: 'Line 3', discipline: 'doubles', bestOf: 3, noAd: false, miniSets: true, finalSetTiebreak: true },
      { id: 'l4', label: 'Line 4', discipline: 'doubles', bestOf: 3, noAd: false, miniSets: true, finalSetTiebreak: true }
    ]
  },
  participation: {
    minMatches: 3,
    maxMatches: 6,
    maxSinglesDays: 2,
    maxTotalMatchDays: 6,
    maxPartnerDays: 3,
    injuryPolicy: 'Injury/replacement by mutual agreement; notify the organizer before the match day.'
  },
  scoring: {
    pointsWin: 1,
    pointsLoss: 0,
    pointsForfeit: 0,
    tiebreakOrder: ['points', 'sets', 'singlesWins', 'headToHead', 'games']
  },
  playoffs: {
    qualifyPerGroup: 2,
    structure: 'SF_F',
    seeding: 'group_cross',
    semisWindowDays: 5,
    finalsWindowDays: 10
  },
  roster: {
    assignment: 'admin',
    budget: 100000,
    captainExcludedFromPool: true,
    stackFlagThreshold: 0.75
  }
};

function clampNumber(value, fallback, { min, max, integer } = {}) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = Number(fallback);
  if (!Number.isFinite(n)) n = 0;
  if (integer) n = Math.floor(n);
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}

function cleanString(value, fallback = '') {
  const s = String(value == null ? '' : value).trim();
  return s || fallback;
}

function normalizeTiers(tiers, fallback) {
  if (!Array.isArray(tiers) || tiers.length === 0) return fallback.map(t => ({ ...t }));
  return tiers
    .map((tier, idx) => ({
      id: cleanString(tier?.id, `tier_${idx + 1}`),
      label: cleanString(tier?.label, `Tier ${idx + 1}`),
      min: clampNumber(tier?.min, 0, { min: 0 }),
      max: clampNumber(tier?.max, 16.5, { min: 0 })
    }))
    .sort((a, b) => a.min - b.min);
}

function normalizeGroups(groups, fallback) {
  if (!Array.isArray(groups) || groups.length === 0) return fallback.map(g => ({ ...g }));
  return groups.map((group, idx) => {
    const label = cleanString(group?.label || group?.id, String.fromCharCode(65 + idx));
    return { id: cleanString(group?.id, label), label };
  });
}

function normalizeLineFormats(lines, fallback) {
  if (!Array.isArray(lines) || lines.length === 0) return fallback.map(l => ({ ...l }));
  return lines.map((line, idx) => ({
    id: cleanString(line?.id, `l${idx + 1}`),
    label: cleanString(line?.label, `Line ${idx + 1}`),
    discipline: line?.discipline === 'doubles' ? 'doubles' : 'singles',
    bestOf: [1, 3, 5].includes(Number(line?.bestOf)) ? Number(line.bestOf) : 3,
    noAd: !!line?.noAd,
    miniSets: line?.miniSets !== false,
    finalSetTiebreak: !!line?.finalSetTiebreak
  }));
}

function normalizeTiebreakOrder(order, fallback) {
  const valid = Object.keys(TIEBREAK_KEYS);
  const seen = new Set();
  const result = [];
  (Array.isArray(order) ? order : []).forEach(key => {
    if (valid.includes(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  });
  // Backfill any missing keys in the fallback order so the sort is always total.
  fallback.forEach(key => {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  });
  return result;
}

// Deeply normalize an arbitrary (possibly partial) config blob against the
// defaults. Always returns a fully-populated, safe-to-render config.
export function normalizeConfig(raw = {}) {
  const d = DEFAULT_CONFIG;
  const club = { ...d.club, ...(raw.club || {}) };
  const teams = { ...d.teams, ...(raw.teams || {}) };
  const rating = { ...d.rating, ...(raw.rating || {}) };
  const format = { ...d.format, ...(raw.format || {}) };
  const participation = { ...d.participation, ...(raw.participation || {}) };
  const scoring = { ...d.scoring, ...(raw.scoring || {}) };
  const playoffs = { ...d.playoffs, ...(raw.playoffs || {}) };
  const roster = { ...d.roster, ...(raw.roster || {}) };

  const teamCount = clampNumber(teams.count, d.teams.count, { min: 2, max: 64, integer: true });
  const minSquad = clampNumber(teams.minSquad, d.teams.minSquad, { min: 1, max: 30, integer: true });
  const maxSquad = clampNumber(teams.maxSquad, d.teams.maxSquad, { min: minSquad, max: 30, integer: true });

  const normalizedFormat = {
    type: FORMAT_TYPES.includes(format.type) ? format.type : d.format.type,
    groups: normalizeGroups(format.groups, d.format.groups),
    linesPerTie: clampNumber(format.linesPerTie, d.format.linesPerTie, { min: 1, max: 12, integer: true }),
    singlesLines: clampNumber(format.singlesLines, d.format.singlesLines, { min: 0, max: 12, integer: true }),
    doublesLines: clampNumber(format.doublesLines, d.format.doublesLines, { min: 0, max: 12, integer: true }),
    lineFormats: normalizeLineFormats(format.lineFormats, d.format.lineFormats)
  };

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    seasonId: cleanString(raw.seasonId, d.seasonId),
    updatedAt: raw.updatedAt || null,
    club: {
      name: cleanString(club.name, d.club.name),
      tagline: cleanString(club.tagline, d.club.tagline),
      seasonName: cleanString(club.seasonName, d.club.seasonName),
      logoEmoji: cleanString(club.logoEmoji, d.club.logoEmoji),
      logoUrl: cleanString(club.logoUrl, ''),
      primaryColor: cleanString(club.primaryColor, d.club.primaryColor),
      accentColor: cleanString(club.accentColor, d.club.accentColor),
      publicViewEnabled: club.publicViewEnabled !== false,
      publicViewNote: cleanString(club.publicViewNote, d.club.publicViewNote)
    },
    teams: { count: teamCount, minSquad, maxSquad },
    rating: {
      type: RATING_TYPES.includes(rating.type) ? rating.type : d.rating.type,
      label: cleanString(rating.label, d.rating.label),
      min: clampNumber(rating.min, d.rating.min, { min: 0 }),
      max: clampNumber(rating.max, d.rating.max, { min: 0 }),
      tiers: normalizeTiers(rating.tiers, d.rating.tiers)
    },
    format: normalizedFormat,
    participation: {
      minMatches: clampNumber(participation.minMatches, d.participation.minMatches, { min: 0, max: 50, integer: true }),
      maxMatches: clampNumber(participation.maxMatches, d.participation.maxMatches, { min: 1, max: 50, integer: true }),
      maxSinglesDays: clampNumber(participation.maxSinglesDays, d.participation.maxSinglesDays, { min: 0, max: 50, integer: true }),
      maxTotalMatchDays: clampNumber(participation.maxTotalMatchDays, d.participation.maxTotalMatchDays, { min: 1, max: 50, integer: true }),
      maxPartnerDays: clampNumber(participation.maxPartnerDays, d.participation.maxPartnerDays, { min: 1, max: 50, integer: true }),
      injuryPolicy: cleanString(participation.injuryPolicy, d.participation.injuryPolicy)
    },
    scoring: {
      pointsWin: clampNumber(scoring.pointsWin, d.scoring.pointsWin, { min: 0 }),
      pointsLoss: clampNumber(scoring.pointsLoss, d.scoring.pointsLoss, { min: 0 }),
      pointsForfeit: clampNumber(scoring.pointsForfeit, d.scoring.pointsForfeit, { min: 0 }),
      tiebreakOrder: normalizeTiebreakOrder(scoring.tiebreakOrder, d.scoring.tiebreakOrder)
    },
    playoffs: {
      qualifyPerGroup: clampNumber(playoffs.qualifyPerGroup, d.playoffs.qualifyPerGroup, { min: 1, max: 16, integer: true }),
      structure: cleanString(playoffs.structure, d.playoffs.structure),
      seeding: cleanString(playoffs.seeding, d.playoffs.seeding),
      semisWindowDays: clampNumber(playoffs.semisWindowDays, d.playoffs.semisWindowDays, { min: 0, integer: true }),
      finalsWindowDays: clampNumber(playoffs.finalsWindowDays, d.playoffs.finalsWindowDays, { min: 0, integer: true })
    },
    roster: {
      assignment: ROSTER_ASSIGNMENT_MODES.includes(roster.assignment) ? roster.assignment : d.roster.assignment,
      budget: clampNumber(roster.budget, d.roster.budget, { min: 0 }),
      captainExcludedFromPool: roster.captainExcludedFromPool !== false,
      stackFlagThreshold: clampNumber(roster.stackFlagThreshold, d.roster.stackFlagThreshold, { min: 0, max: 1 })
    }
  };
}

// Map a numeric rating into one of the configured tiers.
export function tierForRating(config, rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return null;
  const tiers = config?.rating?.tiers || [];
  return tiers.find(tier => value >= tier.min && value <= tier.max)
    || tiers[tiers.length - 1]
    || null;
}

// Derive the eligibility-rules shape the existing ScoreEntry/CaptainCapacity
// code already consumes, so those working features keep functioning unchanged.
export function eligibilityRulesFromConfig(config) {
  const p = normalizeConfig(config).participation;
  return {
    maxSinglesDays: p.maxSinglesDays,
    maxTotalMatchDays: p.maxTotalMatchDays,
    maxPartnerDays: p.maxPartnerDays
  };
}

// Produce a template record (strips season-specific identifiers) for
// "clone last season" reuse.
export function configToTemplate(config, name) {
  const normalized = normalizeConfig(config);
  return {
    name: cleanString(name, `${normalized.club.seasonName} template`),
    savedAt: Date.now(),
    config: { ...normalized, seasonId: undefined, updatedAt: undefined }
  };
}
