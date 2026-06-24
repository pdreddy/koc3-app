// Thin data-access layer.
//
// Goal: keep Firebase reads/writes behind one module instead of scattering
// `ref(db, ...)` calls through components, so a future native app, REST API, or
// a different backend can reuse the same interface. It is also tenant-aware:
// every path is derived from a { clubId, seasonId } context, modeling the
// multi-tenant hierarchy from day one while defaulting to the existing single
// club/season storage so no data moves.

import { ref, get, set, update, remove, push, onValue } from 'firebase/database';
import { db, ensureAuth, PATHS } from '../firebase';

export const DEFAULT_TENANT = { clubId: 'koc', seasonId: 'koc3' };

// Resolve the storage prefix for a tenant. The canonical KOC3 season keeps its
// existing `koc_s3` root for backward compatibility; any other tenant uses the
// generic multi-tenant layout `clubs/<clubId>/seasons/<seasonId>`.
export function rootForTenant(ctx = DEFAULT_TENANT) {
  const clubId = ctx?.clubId || DEFAULT_TENANT.clubId;
  const seasonId = ctx?.seasonId || DEFAULT_TENANT.seasonId;
  if (clubId === 'koc' && seasonId === 'koc3') return 'koc_s3';
  return `clubs/${clubId}/seasons/${seasonId}`;
}

// Path map for a tenant. For the legacy tenant this returns exactly the existing
// PATHS so current data is reused verbatim.
export function pathsFor(ctx = DEFAULT_TENANT) {
  const root = rootForTenant(ctx);
  if (root === 'koc_s3') return { ...PATHS };
  const p = {};
  Object.entries(PATHS).forEach(([key, value]) => {
    // Re-root the koc_s3/* paths; leave absolute legacy archives (KOC2DB) alone.
    p[key] = value.startsWith('koc_s3/') ? value.replace('koc_s3', root) : value;
  });
  return p;
}

// Low-level helpers (promise-based).
export const dal = {
  paths: pathsFor,
  async ensureAuth() { return ensureAuth(); },
  async read(path) {
    const snap = await get(ref(db, path));
    return snap.exists() ? snap.val() : null;
  },
  async write(path, value) {
    return set(ref(db, path), value);
  },
  async patch(path, partial) {
    return update(ref(db, path), partial);
  },
  async pushChild(path, value) {
    const r = await push(ref(db, path), value);
    return r.key;
  },
  async removePath(path) {
    return remove(ref(db, path));
  },
  // Subscribe to a path; returns an unsubscribe function.
  subscribe(path, onData, onError) {
    return onValue(ref(db, path), snap => onData(snap.val()), onError);
  }
};

// --- Domain-oriented convenience methods (tenant-scoped) -------------------

export function configRepo(ctx = DEFAULT_TENANT) {
  const path = pathsFor(ctx).config;
  return {
    path,
    read: () => dal.read(path),
    write: (value) => dal.write(path, value),
    subscribe: (cb, err) => dal.subscribe(path, cb, err)
  };
}

export function teamsRepo(ctx = DEFAULT_TENANT) {
  const path = pathsFor(ctx).teams;
  return {
    path,
    readAll: () => dal.read(path),
    writeAll: (value) => dal.write(path, value),
    update: (partial) => dal.patch(path, partial),
    updateOne: (teamId, partial) => dal.patch(`${path}/${teamId}`, partial),
    subscribe: (cb, err) => dal.subscribe(path, cb, err)
  };
}

export function matchesRepo(ctx = DEFAULT_TENANT) {
  const path = pathsFor(ctx).matches;
  return {
    path,
    readAll: () => dal.read(path),
    add: (record) => dal.pushChild(path, record),
    removeOne: (matchId) => dal.removePath(`${path}/${matchId}`),
    clearAll: () => dal.removePath(path),
    subscribe: (cb, err) => dal.subscribe(path, cb, err)
  };
}

export function templatesRepo(ctx = DEFAULT_TENANT) {
  const path = pathsFor(ctx).seasonTemplates;
  return {
    path,
    readAll: () => dal.read(path),
    add: (record) => dal.pushChild(path, record),
    removeOne: (id) => dal.removePath(`${path}/${id}`),
    subscribe: (cb, err) => dal.subscribe(path, cb, err)
  };
}
