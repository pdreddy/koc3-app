import { useState } from 'react';
import type { TournamentConfig } from '@/types';
import { buildDefaultTournamentConfig } from '@/services/defaultTournamentConfig';

// Local, unsaved draft of the config being built across wizard steps. Nothing is written
// to Firestore until the final "Create Tournament" action — each step just patches this
// in-memory object so the admin can go back and forth freely.
// matchTypes/lineup are arrays, not mergeable objects — patch() only applies to the
// object-shaped sections; use setField() to replace an array section wholesale.
type PatchableSection = Exclude<keyof TournamentConfig, 'matchTypes' | 'lineup'>;

export function useWizardDraft() {
  const [draft, setDraft] = useState<TournamentConfig>(() => buildDefaultTournamentConfig());

  function patch<K extends PatchableSection>(section: K, value: Partial<TournamentConfig[K]>) {
    setDraft((prev) => ({ ...prev, [section]: { ...(prev[section] as object), ...value } }));
  }

  function setField<K extends keyof TournamentConfig>(section: K, value: TournamentConfig[K]) {
    setDraft((prev) => ({ ...prev, [section]: value }));
  }

  return { draft, patch, setField };
}
