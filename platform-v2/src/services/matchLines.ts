import type { MatchTypeCode, TournamentConfig } from '@/types';

export interface LineSpec {
  label: string;
  matchType: MatchTypeCode;
  playersPerSide: number;
}

/** Expands config.lineup (e.g. "2 doubles") into individually labeled lines
 * ("Doubles 1", "Doubles 2") using the matching MatchTypeConfig for playersPerSide/label. */
export function buildLineSpecs(config: TournamentConfig): LineSpec[] {
  const typeByCode = new Map(config.matchTypes.map((t) => [t.code, t]));
  return config.lineup.flatMap((slot) => {
    const typeConfig = typeByCode.get(slot.matchType);
    const playersPerSide = typeConfig?.playersPerSide ?? 1;
    const baseLabel = typeConfig?.label ?? slot.matchType;
    return Array.from({ length: slot.count }, (_, i) => ({
      label: slot.count > 1 ? `${baseLabel} ${i + 1}` : baseLabel,
      matchType: slot.matchType,
      playersPerSide,
    }));
  });
}
