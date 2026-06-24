// Versioned config + a simple migration path, so editing the schema never
// breaks past seasons. Each migration moves a config blob from version N to N+1.
// `runMigrations` applies them in order up to CONFIG_SCHEMA_VERSION.

import { CONFIG_SCHEMA_VERSION } from './seasonConfig';

// Migrations keyed by the version they UPGRADE FROM. A function receives the raw
// config at version `from` and must return it at version `from + 1`.
const MIGRATIONS = {
  // v1 (config-driven refactor) → v2 (future-proof architecture: tenant, sport,
  // feature-flag modules). Defaults are filled by normalizeConfig afterwards, so
  // here we only need to add structural anchors and bump the stamp.
  1: (cfg) => ({
    ...cfg,
    schemaVersion: 2,
    tenant: cfg.tenant || { clubId: 'koc', seasonId: cfg.seasonId || 'koc3' },
    sport: cfg.sport || 'tennis',
    modules: cfg.modules || {}
  })
};

export function runMigrations(rawConfig = {}) {
  let cfg = { ...(rawConfig || {}) };
  let from = Number(cfg.schemaVersion) || 1;
  let changed = false;

  while (from < CONFIG_SCHEMA_VERSION && MIGRATIONS[from]) {
    cfg = MIGRATIONS[from](cfg);
    from = Number(cfg.schemaVersion) || from + 1;
    changed = true;
  }

  // If the config predates versioning entirely, stamp it.
  if (cfg.schemaVersion == null) {
    cfg.schemaVersion = CONFIG_SCHEMA_VERSION;
    changed = true;
  }

  return { config: cfg, changed };
}
