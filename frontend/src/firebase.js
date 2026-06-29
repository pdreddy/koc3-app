// ============================================================================
// Supabase-backed data layer (drop-in replacement for the old Firebase RTDB).
// ----------------------------------------------------------------------------
// The rest of the app was written against a handful of Firebase Realtime
// Database helpers (ref / get / set / update / push / remove / onValue). This
// module re-implements exactly that small surface on top of real Postgres
// tables in Supabase, so the existing tournament logic keeps working unchanged.
//
// Each former RTDB "node" maps to a table (see REGISTRY below). Records are
// stored in a `data` jsonb column; this layer translates path-based reads and
// writes into Supabase queries + realtime subscriptions.
// ============================================================================
import { supabase } from './supabaseClient';
import { PATHS } from './firebasePaths';

export { PATHS };
export { supabase };

// Sentinel returned by the old `db` export. ref(db, path) carries the path.
export const db = { __supabaseRoot: true };

// --- Path → table registry ---------------------------------------------------
// kind: 'collection' (rows keyed by `keyCol`), 'singleton' (one fixed row),
//       'nested2' (two-level RTDB node scheduleId/teamId).
const REGISTRY = [
  { prefix: PATHS.teams,                table: 'teams',                  kind: 'collection' },
  { prefix: PATHS.matches,              table: 'matches',                kind: 'collection' },
  { prefix: PATHS.playerRatings,        table: 'player_ratings',         kind: 'collection' },
  { prefix: PATHS.admin,                table: 'admin_config',           kind: 'singleton', id: 'admin' },
  { prefix: PATHS.adminUsers,           table: 'admin_users',            kind: 'collection', keyCol: 'username' },
  { prefix: PATHS.schedule,             table: 'schedule',               kind: 'collection' },
  { prefix: PATHS.settings,             table: 'settings',               kind: 'singleton', id: 'settings' },
  { prefix: PATHS.standings,            table: 'standings',              kind: 'collection' },
  { prefix: PATHS.pprcRatings,          table: 'pprc_ratings',           kind: 'collection' },
  { prefix: PATHS.playerHistory,        table: 'player_history',         kind: 'collection' },
  { prefix: PATHS.teamHistory,          table: 'team_history',           kind: 'collection' },
  { prefix: PATHS.playerMatchups,       table: 'player_matchups',        kind: 'collection' },
  { prefix: PATHS.teamMatchups,         table: 'team_matchups',          kind: 'collection' },
  { prefix: PATHS.playerEligibility,    table: 'player_eligibility',     kind: 'collection' },
  { prefix: PATHS.cachedSummaries,      table: 'cached_summaries',       kind: 'singleton', id: 'cachedSummaries' },
  { prefix: PATHS.auditLogs,            table: 'audit_logs',             kind: 'collection' },
  { prefix: PATHS.lineupSubmissions,    table: 'lineup_submissions',     kind: 'nested2' },
  { prefix: PATHS.lineupSubmissionMeta, table: 'lineup_submission_meta', kind: 'nested2' },
  { prefix: PATHS.revealedLineups,      table: 'revealed_lineups',       kind: 'collection' },
  { prefix: PATHS.lineupUnlocks,        table: 'lineup_unlocks',         kind: 'collection' },
  { prefix: PATHS.lineupDeletes,        table: 'lineup_deletes',         kind: 'collection' },
  { prefix: PATHS.koc2db,               table: 'legacy_koc2db',          kind: 'singleton', id: 'root' },
  { prefix: PATHS.season1,              table: 'legacy_season1',         kind: 'singleton', id: 'root' },
].sort((a, b) => b.prefix.length - a.prefix.length); // longest prefix wins

function resolve(path) {
  const clean = String(path || '').replace(/^\/+|\/+$/g, '');
  const entry = REGISTRY.find((e) => clean === e.prefix || clean.startsWith(e.prefix + '/'));
  if (!entry) throw new Error(`Unknown data path: "${path}"`);
  const remainder = clean.slice(entry.prefix.length).split('/').filter(Boolean);
  return { entry, remainder, keyCol: entry.keyCol || 'id' };
}

// --- small helpers -----------------------------------------------------------
const clone = (v) => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

function deepGet(obj, pathArr) {
  let cur = obj;
  for (const k of pathArr) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
}

function deepSet(target, pathArr, value) {
  const root = target && typeof target === 'object' ? target : {};
  if (pathArr.length === 0) return value;
  let cur = root;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[pathArr[pathArr.length - 1]] = value;
  return root;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeSnapshot(val) {
  const empty =
    val == null ||
    (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0);
  return { val: () => val, exists: () => !empty };
}

function fail(error) {
  if (error) throw new Error(`${error.message || error}${error.hint ? ` (${error.hint})` : ''}`);
}

// --- low-level table access --------------------------------------------------
async function fetchRecord(entry, keyCol, idObj) {
  let q = supabase.from(entry.table).select('data');
  Object.entries(idObj).forEach(([col, v]) => { q = q.eq(col, v); });
  const { data, error } = await q.maybeSingle();
  fail(error);
  return data ? clone(data.data) : null;
}

async function upsertRecord(entry, row) {
  const onConflict = entry.kind === 'nested2' ? 'schedule_id,team_id' : (entry.keyCol || 'id');
  const { error } = await supabase.from(entry.table).upsert(row, { onConflict });
  fail(error);
}

async function replaceCollection(entry, keyCol, obj) {
  const entries = Object.entries(obj || {});
  const ids = entries.map(([id]) => id);
  const { data: existing, error: selErr } = await supabase.from(entry.table).select(keyCol);
  fail(selErr);
  const keep = new Set(ids);
  const toDelete = (existing || []).map((r) => r[keyCol]).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from(entry.table).delete().in(keyCol, toDelete);
    fail(error);
  }
  if (entries.length) {
    const rows = entries.map(([id, value]) => ({ [keyCol]: id, data: value ?? {} }));
    const { error } = await supabase.from(entry.table).upsert(rows, { onConflict: keyCol });
    fail(error);
  }
}

// Identify the record a (resolved) path targets, for grouping multi-updates.
function recordTarget(resolved) {
  const { entry, remainder, keyCol } = resolved;
  if (entry.kind === 'singleton') {
    return { entry, idObj: { id: entry.id }, inner: remainder, isCollectionRoot: false };
  }
  if (entry.kind === 'nested2') {
    if (remainder.length < 2) throw new Error(`Cannot target ${entry.table} above record level`);
    return {
      entry,
      idObj: { schedule_id: remainder[0], team_id: remainder[1] },
      inner: remainder.slice(2),
      isCollectionRoot: false,
    };
  }
  // collection
  if (remainder.length === 0) return { entry, isCollectionRoot: true, keyCol };
  return { entry, idObj: { [keyCol]: remainder[0] }, inner: remainder.slice(1), isCollectionRoot: false };
}

function rowFromId(entry, idObj, data) {
  return { ...idObj, data: data ?? {} };
}

// --- reads -------------------------------------------------------------------
async function readResolved(resolved) {
  const { entry, remainder, keyCol } = resolved;

  if (entry.kind === 'singleton') {
    const rec = await fetchRecord(entry, 'id', { id: entry.id });
    return remainder.length ? deepGet(rec, remainder) : rec;
  }

  if (entry.kind === 'nested2') {
    if (remainder.length === 0) {
      const { data, error } = await supabase.from(entry.table).select('schedule_id,team_id,data');
      fail(error);
      const out = {};
      (data || []).forEach((r) => {
        out[r.schedule_id] = out[r.schedule_id] || {};
        out[r.schedule_id][r.team_id] = r.data;
      });
      return out;
    }
    if (remainder.length === 1) {
      const { data, error } = await supabase
        .from(entry.table).select('team_id,data').eq('schedule_id', remainder[0]);
      fail(error);
      const out = {};
      (data || []).forEach((r) => { out[r.team_id] = r.data; });
      return out;
    }
    const rec = await fetchRecord(entry, null, { schedule_id: remainder[0], team_id: remainder[1] });
    return remainder.length > 2 ? deepGet(rec, remainder.slice(2)) : rec;
  }

  // collection
  if (remainder.length === 0) {
    const { data, error } = await supabase.from(entry.table).select(`${keyCol},data`);
    fail(error);
    const out = {};
    (data || []).forEach((r) => { out[r[keyCol]] = r.data; });
    return out;
  }
  const rec = await fetchRecord(entry, keyCol, { [keyCol]: remainder[0] });
  return remainder.length > 1 ? deepGet(rec, remainder.slice(1)) : rec;
}

// --- multi-path write (the heart of update()/set()) --------------------------
// `entries` is a list of [absolutePath, value]. Groups writes per target record
// so multiple field updates to the same record are merged into one upsert.
async function applyEntries(entries) {
  const collectionReplaces = [];
  const groups = new Map(); // key -> { entry, idObj, replace, sets: [[inner,value]] }

  for (const [path, value] of entries) {
    const resolved = resolve(path);
    const target = recordTarget(resolved);
    if (target.isCollectionRoot) {
      collectionReplaces.push({ entry: target.entry, keyCol: target.keyCol, value });
      continue;
    }
    const key = `${target.entry.table}|${Object.values(target.idObj).join('|')}`;
    let g = groups.get(key);
    if (!g) { g = { entry: target.entry, idObj: target.idObj, replace: undefined, sets: [] }; groups.set(key, g); }
    if (target.inner.length === 0) { g.replace = value; g.sets = []; }
    else g.sets.push([target.inner, value]);
  }

  const ops = [];

  for (const { entry, keyCol, value } of collectionReplaces) {
    ops.push(replaceCollection(entry, keyCol, value));
  }

  // Whole-record writes to the same table are batched into ONE upsert (a single
  // request, instead of one per record). Field-merge groups need a prior read,
  // so they're handled individually.
  const replaceByTable = new Map();
  for (const g of groups.values()) {
    if (g.sets.length === 0 && g.replace !== undefined) {
      let b = replaceByTable.get(g.entry.table);
      if (!b) { b = { entry: g.entry, rows: [] }; replaceByTable.set(g.entry.table, b); }
      b.rows.push(rowFromId(g.entry, g.idObj, clone(g.replace) ?? {}));
    } else {
      ops.push((async () => {
        const data = g.replace !== undefined ? (clone(g.replace) ?? {}) : ((await fetchRecord(g.entry, null, g.idObj)) || {});
        for (const [inner, value] of g.sets) deepSet(data, inner, value);
        await upsertRecord(g.entry, rowFromId(g.entry, g.idObj, data));
      })());
    }
  }
  for (const { entry, rows } of replaceByTable.values()) {
    const onConflict = entry.kind === 'nested2' ? 'schedule_id,team_id' : (entry.keyCol || 'id');
    ops.push((async () => { const { error } = await supabase.from(entry.table).upsert(rows, { onConflict }); fail(error); })());
  }

  await Promise.all(ops);
}

// --- public API (mirrors firebase/database) ---------------------------------
export function ref(_db, path = null) {
  return { __ref: true, path: path == null ? null : String(path) };
}

export function child(parent, sub) {
  const base = parent && parent.path ? parent.path : '';
  return { __ref: true, path: base ? `${base}/${sub}` : String(sub) };
}

export async function get(reference) {
  return makeSnapshot(await readResolved(resolve(reference.path)));
}

export async function set(reference, value) {
  await applyEntries([[reference.path, value]]);
}

export async function update(reference, updates) {
  const base = reference && reference.path ? reference.path : null;
  const entries = Object.entries(updates || {}).map(([k, v]) => [base ? `${base}/${k}` : k, v]);
  await applyEntries(entries);
}

export async function remove(reference) {
  const resolved = resolve(reference.path);
  const { entry, remainder, keyCol } = resolved;

  if (entry.kind === 'collection' && remainder.length === 0) {
    return replaceCollection(entry, keyCol, {});
  }
  if (entry.kind === 'singleton' && remainder.length === 0) {
    const { error } = await supabase.from(entry.table).delete().eq('id', entry.id);
    return fail(error);
  }
  const target = recordTarget(resolved);
  if (target.inner && target.inner.length > 0) {
    // remove a field within a record
    const data = (await fetchRecord(entry, null, target.idObj)) || {};
    deepSet(data, target.inner, null);
    return upsertRecord(entry, rowFromId(entry, target.idObj, data));
  }
  let q = supabase.from(entry.table).delete();
  Object.entries(target.idObj).forEach(([col, v]) => { q = q.eq(col, v); });
  const { error } = await q;
  return fail(error);
}

// push(ref) reserves a key (no write, like Firebase). push(ref, value) writes.
export function push(reference, value) {
  const resolved = resolve(reference.path);
  const { entry, keyCol } = resolved;
  if (entry.kind !== 'collection') throw new Error(`Cannot push() onto ${entry.table}`);
  const key = genId();
  const childRef = { __ref: true, path: `${reference.path}/${key}`, key };
  const promise = value === undefined
    ? Promise.resolve()
    : upsertRecord(entry, { [keyCol]: key, data: value });
  return Object.assign(childRef, {
    then: (onOk, onErr) => promise.then(() => (onOk ? onOk(childRef) : childRef), onErr),
    catch: (onErr) => promise.catch(onErr),
  });
}

export function onValue(reference, callback, errorCallback) {
  let active = true;
  const resolved = resolve(reference.path);

  const fire = async () => {
    try {
      const val = await readResolved(resolved);
      if (active) callback(makeSnapshot(val));
    } catch (err) {
      if (!active) return;
      if (errorCallback) errorCallback(err);
      else console.error('onValue read failed for', reference.path, err);
    }
  };

  // Debounce realtime-driven refetches so a burst of row changes (e.g. seeding
  // ~100 rows in one go) collapses into a single re-read instead of one per row.
  let timer = null;
  const scheduleFire = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; fire(); }, 150);
  };

  fire();

  const channel = supabase
    .channel(`rtdb:${resolved.entry.table}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: resolved.entry.table }, () => scheduleFire())
    .subscribe();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

// --- auth bootstrap ----------------------------------------------------------
// With Supabase, logged-out visitors read public data with the anon key (RLS
// allows it). Captains/admins get a real session via the Login page. This just
// makes sure the auth client has finished loading any persisted session.
let authPromise = null;
export function ensureAuth() {
  if (!authPromise) {
    authPromise = supabase.auth.getSession().catch((err) => {
      console.error('Supabase session load failed', err);
    });
  }
  return authPromise;
}
