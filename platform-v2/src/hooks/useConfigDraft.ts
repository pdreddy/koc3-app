import { useState } from 'react';
import type { TournamentConfig } from '@/types';
import { buildDefaultTournamentConfig } from '@/services/defaultTournamentConfig';

// Local, unsaved draft of a TournamentConfig — used by both the Create Tournament wizard
// (starts from buildDefaultTournamentConfig()) and the Tournament Settings screen (starts
// from an existing tournament's config). Nothing is written to Firestore until the caller
// explicitly saves.
// matchTypes/lineup are arrays, not mergeable objects — patch() only applies to the
// object-shaped sections; use setField() to replace an array section wholesale.
type PatchableSection = Exclude<keyof TournamentConfig, 'matchTypes' | 'lineup'>;

export function useConfigDraft(initial?: TournamentConfig) {
  const [draft, setDraft] = useState<TournamentConfig>(() => initial ?? buildDefaultTournamentConfig());

  function patch<K extends PatchableSection>(section: K, value: Partial<TournamentConfig[K]>) {
    setDraft((prev) => ({ ...prev, [section]: { ...(prev[section] as object), ...value } }));
  }

  function setField<K extends keyof TournamentConfig>(section: K, value: TournamentConfig[K]) {
    setDraft((prev) => ({ ...prev, [section]: value }));
  }

  function reset(next: TournamentConfig) {
    setDraft(next);
  }

  return { draft, patch, setField, reset };
}
