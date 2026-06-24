// Pluggable rating system.
//
// A RatingProvider answers "what is this player's rating?" and can optionally
// ingest normalized matches to recompute. One real implementation exists today
// (ManualRating — the organizer types the number). ComputedRating is a
// documented stub so a UTR-style engine can drop in later, consuming the same
// normalized match shape (see domain/model.js toNormalizedMatch) with no data
// migration.

import { playerIdFromName } from './model';

// Base shape every provider conforms to.
// {
//   id: string,
//   label: string,
//   getRating(playerId, { players, ratingsTable }) -> number | null,
//   ingest(normalizedMatches) -> void   // optional; computed engines use this
// }

export const ManualRatingProvider = {
  id: 'MANUAL',
  label: 'Manual entry',
  // Rating is read straight from the player record / ratings table the
  // organizer maintains. Works for UTR/NTRP/custom — the number is just typed.
  getRating(playerId, { players = {}, ratingsTable = {}, ratingType = 'UTR' } = {}) {
    const player = players[playerId];
    if (player?.ratings && Number.isFinite(Number(player.ratings[ratingType]))) {
      return Number(player.ratings[ratingType]);
    }
    // Fall back to the legacy flat ratings table keyed by normalized name.
    const row = ratingsTable[playerId];
    const value = Number(row?.actualUtr ?? row?.utr ?? row?.rating);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
};

// Stub. Returns null until implemented; documents the contract so wiring it in
// later is additive. A real engine would maintain its own rating store updated
// from `ingest`.
export const ComputedRatingProvider = {
  id: 'COMPUTED',
  label: 'Computed (engine)',
  _store: {},
  getRating(playerId) {
    const value = this._store[playerId];
    return Number.isFinite(value) ? value : null;
  },
  ingest(/* normalizedMatches */) {
    // TODO: implement an Elo/UTR-style update over normalizedMatches[].ratingInputs.
    // Intentionally a no-op so the seam exists without behavior change.
  }
};

const REGISTRY = {
  [ManualRatingProvider.id]: ManualRatingProvider,
  [ComputedRatingProvider.id]: ComputedRatingProvider
};

export function getRatingProvider(providerId) {
  return REGISTRY[providerId] || ManualRatingProvider;
}

export function registerRatingProvider(provider) {
  if (provider?.id) REGISTRY[provider.id] = provider;
}

// Convenience: resolve a rating for a player by name using the active provider.
// Defaults to manual entry, which is the only one wired today.
export function resolveRating(name, { config, players, ratingsTable } = {}) {
  const useComputed = !!config?.modules?.computedRating;
  const provider = useComputed ? ComputedRatingProvider : ManualRatingProvider;
  const playerId = playerIdFromName(name);
  const ratingType = config?.rating?.type || 'UTR';
  const value = provider.getRating(playerId, { players, ratingsTable, ratingType });
  if (value == null && useComputed) {
    // Computed not yet populated → fall back to manual so the UI still shows data.
    return ManualRatingProvider.getRating(playerId, { players, ratingsTable, ratingType });
  }
  return value;
}
