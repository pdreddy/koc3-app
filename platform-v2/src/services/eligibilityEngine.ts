import type { EligibilityConfig } from '@/types';

// Tournaments created before the eligibility feature shipped won't have this key in their
// stored config — same fallback pattern as VisibilityGate's DEFAULT_VISIBILITY merge.
export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  enabled: true,
  maxSinglesDaysPerPlayer: 2,
  maxTotalMatchDaysPerPlayer: 6,
  maxPartnerDaysPerPair: 3,
  allowSinglesAndDoublesSameDay: false,
};

export function resolveEligibilityConfig(config: EligibilityConfig | undefined): EligibilityConfig {
  return config ?? DEFAULT_ELIGIBILITY_CONFIG;
}

export interface PlayerCapacity {
  singlesDays: number;
  totalDays: number;
  partnerDays: Record<string, number>;
}

export type CapacityMap = Record<string, PlayerCapacity>;

/** One already-locked-or-played fixture's lines for a single team, reduced to just what the
 * capacity engine needs — the caller builds this from either a LineupSubmission (locked,
 * not yet scored) or an APPROVED Match's lines, preferring the Match when both exist for
 * the same scheduleEntryId (the actual played lineup, not just what was planned). */
export interface FixtureRecord {
  scheduleEntryId: string;
  lines: { playerIds: string[]; isSingles: boolean }[];
}

function ensure(map: CapacityMap, playerId: string): PlayerCapacity {
  return (map[playerId] ||= { singlesDays: 0, totalDays: 0, partnerDays: {} });
}

/** Builds per-player capacity from a team's history of OTHER fixtures — never includes the
 * fixture currently being edited, since that's what the caller is deciding right now. */
export function buildCapacityMap(records: FixtureRecord[]): CapacityMap {
  const map: CapacityMap = {};

  records.forEach((record) => {
    const fixturePlayers = new Set<string>();
    const singlesPlayers = new Set<string>();
    const pairs = new Set<string>();

    record.lines.forEach((line) => {
      line.playerIds.forEach((pid) => fixturePlayers.add(pid));
      if (line.isSingles) {
        line.playerIds.forEach((pid) => singlesPlayers.add(pid));
      } else if (line.playerIds.length === 2) {
        pairs.add([...line.playerIds].sort().join('|'));
      }
    });

    fixturePlayers.forEach((pid) => { ensure(map, pid).totalDays += 1; });
    singlesPlayers.forEach((pid) => { ensure(map, pid).singlesDays += 1; });
    pairs.forEach((key) => {
      const [a, b] = key.split('|');
      ensure(map, a).partnerDays[b] = (ensure(map, a).partnerDays[b] ?? 0) + 1;
      ensure(map, b).partnerDays[a] = (ensure(map, b).partnerDays[a] ?? 0) + 1;
    });
  });

  return map;
}

export interface LineupSlotSpec {
  label: string;
  isSingles: boolean;
}

/** Real-time per-option warnings while building a lineup for a fixture NOT yet in the
 * capacity map — checks what selecting `playerId` into `label` would push this player's
 * running totals to, accounting for other slots already picked in this same in-progress
 * lineup (`currentSelections`). Mirrors koc3-app's Home.js `optionErrors` map. */
export function getSlotWarnings(
  playerId: string,
  label: string,
  lineSpecs: LineupSlotSpec[],
  capacity: CapacityMap,
  config: EligibilityConfig,
  currentSelections: Record<string, string[]>
): string[] {
  if (!config.enabled) return [];
  const thisSpec = lineSpecs.find((s) => s.label === label);
  if (!thisSpec) return [];

  const otherLabelsWithPlayer = lineSpecs.filter(
    (s) => s.label !== label && (currentSelections[s.label] ?? []).includes(playerId)
  );
  const alreadyUsedElsewhereThisFixture = otherLabelsWithPlayer.length > 0;
  const cap = capacity[playerId];
  const warnings: string[] = [];

  if (config.maxTotalMatchDaysPerPlayer != null && !alreadyUsedElsewhereThisFixture) {
    const projected = (cap?.totalDays ?? 0) + 1;
    if (projected > config.maxTotalMatchDaysPerPlayer) {
      warnings.push(`Would exceed total match-day cap (${config.maxTotalMatchDaysPerPlayer})`);
    }
  }

  if (thisSpec.isSingles && config.maxSinglesDaysPerPlayer != null) {
    const alreadySinglesThisFixture = otherLabelsWithPlayer.some((s) => s.isSingles);
    const projected = (cap?.singlesDays ?? 0) + (alreadySinglesThisFixture ? 0 : 1);
    if (projected > config.maxSinglesDaysPerPlayer) {
      warnings.push(`Would exceed singles cap (${config.maxSinglesDaysPerPlayer})`);
    }
  }

  if (!config.allowSinglesAndDoublesSameDay) {
    const hasOppositeType = otherLabelsWithPlayer.some((s) => s.isSingles !== thisSpec.isSingles);
    if (hasOppositeType) {
      warnings.push(thisSpec.isSingles ? 'Already selected for doubles this match day' : 'Already selected for singles this match day');
    }
  }

  return warnings;
}

/** Same idea as getSlotWarnings but for the partner-cap rule specifically, since it needs
 * both players in a doubles pair rather than just one slot's selection. */
export function getPartnerWarning(
  playerId: string,
  partnerId: string,
  capacity: CapacityMap,
  config: EligibilityConfig
): string | null {
  if (!config.enabled || config.maxPartnerDaysPerPair == null) return null;
  const projected = (capacity[playerId]?.partnerDays[partnerId] ?? 0) + 1;
  return projected > config.maxPartnerDaysPerPair
    ? `Would exceed partner cap with this player (${config.maxPartnerDaysPerPair})`
    : null;
}
