// Optional modules, architected as toggleable feature flags. All OFF today, but
// each has a documented interface so it can be enabled later without refactoring
// the core. The flags live on the season Config under `modules`.

export const MODULES = {
  auction: {
    id: 'auction',
    label: 'Player Auction',
    description: 'Budget-based draft to build squads. Adds auction budgets, bids, and spend tracking.',
    // Interface a future implementation must provide:
    //   buildPool(players, config) -> draftablePlayers
    //   placeBid(teamId, playerId, amount) -> result
    //   settle(season) -> rosters
    defaultOn: false
  },
  payments: {
    id: 'payments',
    label: 'Payments & Fees',
    description: 'Collect season/registration fees. Adds invoices, payment status per player/team.',
    // Interface: createInvoice(target, amount), markPaid(invoiceId), getBalance(target)
    defaultOn: false
  },
  social: {
    id: 'social',
    label: 'Chat & Notifications',
    description: 'Contextual messaging and alerts tied to a season/team/match.',
    // Interface: postMessage(channelRef, msg), subscribe(channelRef), notify(target, event)
    defaultOn: false
  },
  computedRating: {
    id: 'computedRating',
    label: 'Computed Rating Engine',
    description: 'Algorithmic rating computed from match results (UTR-style). Manual entry stays as fallback.',
    // Interface: see domain/ratingProvider.js ComputedRatingProvider
    defaultOn: false
  }
};

export function defaultModules() {
  return Object.values(MODULES).reduce((acc, m) => {
    acc[m.id] = m.defaultOn;
    return acc;
  }, {});
}

export function normalizeModules(raw = {}) {
  const out = defaultModules();
  Object.keys(out).forEach(id => {
    if (typeof raw[id] === 'boolean') out[id] = raw[id];
  });
  return out;
}

export function isModuleEnabled(config, moduleId) {
  return !!config?.modules?.[moduleId];
}

export function listModules() {
  return Object.values(MODULES);
}
