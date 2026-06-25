import React, { useMemo, useState, useEffect } from 'react';
import { ref, set, update, remove, push } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ScoreProcessingService } from '../services/ScoreProcessingService';
import { buildScheduleFor8x2 } from '../utils/roundRobin';
import { UTR_RATINGS, matchUtrRating, normalizeNameKey, suggestUtrMatches } from '../data/utrRatings';
import { groupInfoForTeamId, normalizeAuctionTeam, sortByGroupOrder } from '../data/auctionTeams';
import { normalizeEligibilityRules } from '../utils/eligibilityRules';
import { writeAuditLog } from '../services/AuditService';


function ratingRowId(row) {
  return row?._id || String(row?.fullName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function uniqueValues(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function collectPlayerNames(teams, matches, previousMatches) {
  const names = new Map();
  const add = (name, source) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const current = names.get(clean) || { name: clean, sources: new Set(), count: 0 };
    current.sources.add(source);
    current.count += 1;
    names.set(clean, current);
  };

  Object.values(teams || {}).forEach(team => {
    (team.players || []).forEach(player => add(player.name, `Roster ${team.abbreviation || team.name || ''}`.trim()));
  });
  [...(matches || []), ...(previousMatches || [])].forEach(match => {
    (match.lines || []).forEach(line => {
      [...(line.players?.team1 || []), ...(line.players?.team2 || [])].forEach(name => add(name, match.source || 'Match'));
    });
  });

  return Array.from(names.values()).map(row => ({
    ...row,
    sources: Array.from(row.sources).join(', ')
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function AdminNameMapRow({ sourceName, sourceInfo, lookupRows }) {
  const suggestions = useMemo(() => suggestUtrMatches(sourceName, lookupRows, 5), [sourceName, lookupRows]);
  const [targetName, setTargetName] = useState(suggestions[0]?.row.fullName || lookupRows[0]?.fullName || '');
  const [msg, setMsg] = useState('');
  const targetRow = lookupRows.find(row => row.fullName === targetName) || suggestions[0]?.row;

  const saveMapping = async () => {
    if (!targetRow) { setMsg('Select an actual UTR player first.'); return; }
    const id = ratingRowId(targetRow);
    if (!id) { setMsg('Selected rating row has no Firebase id.'); return; }
    const aliases = uniqueValues([...(targetRow.aliases || []), sourceName]);
    const keys = uniqueValues([...(targetRow.keys || []), normalizeNameKey(sourceName)]);
    try {
      await update(ref(db, `${PATHS.playerRatings}/${id}`), { aliases, keys });
      setMsg(`✅ DB updated: ${sourceName} → ${targetRow.fullName}`);
    } catch (e) {
      setMsg(`Save failed: ${e.message}`);
    }
  };

  return (
    <tr data-testid={`admin-name-map-${sourceName}`}>
      <td>
        <strong>{sourceName}</strong>
        <div className="muted" style={{ fontSize: '.72rem' }}>{sourceInfo.sources} · {sourceInfo.count} occurrence{sourceInfo.count === 1 ? '' : 's'}</div>
      </td>
      <td>
        {suggestions.length === 0 ? '—' : suggestions.map(item => (
          <button
            type="button"
            key={item.row.fullName}
            className={`tag ${item.score >= 0.72 ? 'tie' : ''}`}
            onClick={() => setTargetName(item.row.fullName)}
            title={item.reason}
            style={{ marginRight: '.25rem', marginBottom: '.25rem' }}
          >
            {item.row.fullName} · {Math.round(item.score * 100)}%
          </button>
        ))}
      </td>
      <td>
        <select className="select" value={targetName} onChange={e => setTargetName(e.target.value)} data-testid={`admin-name-map-${sourceName}-select`}>
          {lookupRows.map(row => <option key={row.fullName} value={row.fullName}>{row.fullName}</option>)}
        </select>
      </td>
      <td>
        <button type="button" className="btn small success" onClick={saveMapping} data-testid={`admin-name-map-${sourceName}-save`}>Update DB Mapping</button>
        {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'} style={{ marginTop: '.35rem' }}>{msg}</div>}
      </td>
    </tr>
  );
}

function NameMappingAdmin({ teams, matches, previousMatches, playerRatings }) {
  const [filter, setFilter] = useState('unmapped');
  const lookupRows = useMemo(() => {
    const rows = Object.entries(playerRatings || {}).map(([id, row]) => ({ _id: id, ...(row || {}) }));
    return rows.length > 0 ? rows : UTR_RATINGS;
  }, [playerRatings]);
  const sourceNames = useMemo(() => collectPlayerNames(teams, matches, previousMatches), [teams, matches, previousMatches]);
  const rows = useMemo(() => sourceNames.map(row => {
    const matched = matchUtrRating(row.name, lookupRows);
    return {
      ...row,
      matchedName: matched?.row.fullName || '',
      confidence: matched ? Math.round(matched.score * 100) : 0,
      reason: matched?.reason || 'Needs mapping'
    };
  }), [lookupRows, sourceNames]);
  const visibleRows = rows.filter(row => filter === 'all' || !row.matchedName);

  return (
    <div className="card" data-testid="admin-name-mapping-card">
      <h2>PTL Name Mapping</h2>
      <p className="hint">Map roster, KOC3 match, and KOC2 history names to actual UTR players. Clicking <strong>Update DB Mapping</strong> writes aliases and normalized keys directly to /koc_s3/playerRatings.</p>
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.7rem' }}>
        <button className={`btn small ${filter === 'unmapped' ? '' : 'ghost'}`} onClick={() => setFilter('unmapped')} data-testid="admin-name-map-filter-unmapped">Needs mapping ({rows.filter(row => !row.matchedName).length})</button>
        <button className={`btn small ${filter === 'all' ? '' : 'ghost'}`} onClick={() => setFilter('all')} data-testid="admin-name-map-filter-all">All names ({rows.length})</button>
      </div>
      <div className="table-wrap">
        <table className="std ptl-table" data-testid="admin-name-mapping-table">
          <thead>
            <tr>
              <th>Source name</th>
              <th>Fuzzy suggestions</th>
              <th>Actual UTR player</th>
              <th>DB action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && <tr><td colSpan="4" className="center muted">No names need mapping.</td></tr>}
            {visibleRows.map(row => <AdminNameMapRow key={row.name} sourceName={row.name} sourceInfo={row} lookupRows={lookupRows} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function applyNameRenamesToMatch(match, team, payload, playerRenameMap) {
  let changed = false;
  const next = { ...(match || {}) };
  const oldTeamName = String(team.name || '').trim();
  const newTeamName = String(payload.name || '').trim();

  if ((next.t1Id === team.id || next.t1 === oldTeamName) && next.t1 !== newTeamName) {
    next.t1 = newTeamName;
    changed = true;
  }
  if ((next.t2Id === team.id || next.t2 === oldTeamName) && next.t2 !== newTeamName) {
    next.t2 = newTeamName;
    changed = true;
  }
  if (next.win === oldTeamName && newTeamName) {
    next.win = newTeamName;
    changed = true;
  }
  if (next.winner === oldTeamName && newTeamName) {
    next.winner = newTeamName;
    changed = true;
  }

  if (Array.isArray(next.lines) && Object.keys(playerRenameMap).length > 0) {
    const lines = next.lines.map(line => {
      let lineChanged = false;
      const players = { ...(line.players || {}) };
      ['team1', 'team2'].forEach(side => {
        if (!Array.isArray(players[side])) return;
        const renamed = players[side].map(name => playerRenameMap[name] || name);
        if (renamed.some((name, idx) => name !== players[side][idx])) lineChanged = true;
        players[side] = renamed;
      });
      if (!lineChanged) return line;
      changed = true;
      return { ...line, players };
    });
    next.lines = lines;
  }

  return changed ? next : null;
}

function TeamJsonImporter() {
  const [msg, setMsg] = useState('');

  const saveTeamsFromJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMsg('');
    try {
      const parsed = JSON.parse(await file.text());
      const sourceTeams = Array.isArray(parsed) ? parsed : Object.values(parsed.teams || parsed);
      if (!Array.isArray(sourceTeams) || sourceTeams.length === 0) {
        setMsg('JSON must contain an array of teams or a { "teams": [...] } object.');
        return;
      }
      const updates = {};
      sourceTeams.forEach((team, index) => {
        const normalized = normalizeAuctionTeam(team, index);
        if (!normalized.name || !normalized.abbreviation || normalized.players.length === 0) {
          throw new Error(`Team ${index + 1} is missing name, abbreviation, or players.`);
        }
        const groupInfo = groupInfoForTeamId(normalized.id, index);
        updates[normalized.id] = {
          ...normalized,
          password: team.password || `KOC${normalized.abbreviation}#3`,
          gradient: team.gradient || index + 1,
          group: team.group || groupInfo.group,
          groupOrder: team.groupOrder || groupInfo.groupOrder
        };
      });
      await update(ref(db, PATHS.teams), updates);
      setMsg(`✅ Updated ${sourceTeams.length} team${sourceTeams.length === 1 ? '' : 's'} from JSON`);
    } catch (e) {
      setMsg('Import failed: ' + e.message);
    }
  };

  return (
    <div className="card" data-testid="admin-team-json-importer">
      <h2>📥 Bulk Team JSON Update</h2>
      <p className="hint">Upload a JSON array (or an object with a <code>teams</code> array) to update all team records, including roster, UTR, base price, auctioned money, captain slot, total spent, and money left.</p>
      <input className="input" type="file" accept="application/json,.json" onChange={saveTeamsFromJson} data-testid="admin-team-json-file" />
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'} style={{ marginTop: '.6rem' }}>{msg}</div>}
    </div>
  );
}

function TeamEditor({ team, matches = [] }) {
  const [name, setName] = useState(team.name);
  const [abbr, setAbbr] = useState(team.abbreviation);
  const [password, setPassword] = useState(team.password || '');
  const [group, setGroup] = useState(team.group || 'A');
  const [players, setPlayers] = useState(team.players || []);
  const [savedMsg, setSavedMsg] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    setName(team.name || '');
    setAbbr(team.abbreviation || '');
    setPassword(team.password || '');
    setGroup(team.group || 'A');
    setPlayers(team.players || []);
  }, [team]);

  const save = async () => {
    setSavedMsg('');
    if (!name.trim() || !abbr.trim()) { setSavedMsg('Name and abbreviation are required'); return; }
    if (!password.trim()) { setSavedMsg('Password required'); return; }
    const normalizedPlayers = players.filter(p => (p.name || '').trim()).map((p, idx) => {
      const utr = Number(p.utr);
      const cleanUtr = p.utr === '' || p.utr == null || !Number.isFinite(utr) ? '' : utr;
      return {
        ...p,
        name: p.name.trim(),
        isCaptain: idx === 0,
        utr: cleanUtr,
        actualUtr: p.actualUtr ?? cleanUtr
      };
    });
    const captain = normalizedPlayers[0]?.name || team.captain || '';
    const payload = {
      ...team,
      name: name.trim(),
      abbreviation: abbr.trim().toUpperCase(),
      password: password.trim(),
      group,
      captain,
      players: normalizedPlayers,
      updatedAt: Date.now()
    };
    const playerRenameMap = {};
    normalizedPlayers.forEach((player, idx) => {
      const oldName = String((team.players || [])[idx]?.name || '').trim();
      if (oldName && oldName !== player.name) playerRenameMap[oldName] = player.name;
    });
    const updates = { [`${PATHS.teams}/${team.id}`]: payload };
    (matches || []).forEach(match => {
      const renamedMatch = applyNameRenamesToMatch(match, team, payload, playerRenameMap);
      if (renamedMatch?.id) updates[`${PATHS.matches}/${renamedMatch.id}`] = { ...renamedMatch, updatedAt: Date.now(), nameSyncBy: session?.userId || session?.role || 'admin' };
    });
    try {
      await update(ref(db), updates);
      await ScoreProcessingService.processMatchResult(null, { session, write: true });
      const renamedPlayers = Object.keys(playerRenameMap).length;
      const renamedMatches = Object.keys(updates).filter(path => path.startsWith(`${PATHS.matches}/`)).length;
      setSavedMsg(`✅ Saved and synced ${renamedPlayers} player rename${renamedPlayers === 1 ? '' : 's'} across ${renamedMatches} match record${renamedMatches === 1 ? '' : 's'}`);
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      setSavedMsg('Save failed: ' + e.message);
    }
  };

  const addPlayer = () => setPlayers([...players, { name: '', isCaptain: players.length === 0 }]);
  const removePlayer = (i) => setPlayers(players.filter((_, j) => j !== i));
  const updatePlayer = (i, patch) => setPlayers(players.map((p, j) => j === i ? { ...p, ...patch } : p));
  const setCaptain = () => setPlayers(players.map((p, j) => ({ ...p, isCaptain: j === 0 })));

  return (
    <div className="card" data-testid={`admin-team-${team.abbreviation}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{name || team.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
          <span className={`team-grad-${team.gradient || 1} abbr`} style={{ color: '#fff', padding: '.25rem .6rem', borderRadius: 999, fontWeight: 800, fontSize: '.75rem' }}>{abbr}</span>
          <button className="btn small success" onClick={save} data-testid={`admin-team-${team.abbreviation}-save-top`}>Save Team & Sync Names</button>
        </div>
      </div>

      <div className="field">
        <div className="field-label">Team Name</div>
        <input className="input" value={name} onChange={e => setName(e.target.value)} data-testid={`admin-team-${team.abbreviation}-name`} />
      </div>
      <div className="field">
        <div className="field-label">Abbreviation</div>
        <input className="input" value={abbr} onChange={e => setAbbr(e.target.value.toUpperCase())} maxLength={6} data-testid={`admin-team-${team.abbreviation}-abbr`} />
      </div>
      <div className="field">
        <div className="field-label">Group</div>
        <select
          className="select"
          value={group}
          onChange={e => setGroup(e.target.value)}
          data-testid={`admin-team-${team.abbreviation}-group`}
        >
          <option value="A">Group A</option>
          <option value="B">Group B</option>
        </select>
      </div>
      <div className="field">
        <div className="field-label">Team Password</div>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          <input
            className="input"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            data-testid={`admin-team-${team.abbreviation}-password`}
          />
          <button type="button" className="btn small ghost" onClick={() => setShowPwd(s => !s)} data-testid={`admin-team-${team.abbreviation}-show-pwd`}>
            {showPwd ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className="field">
        <div className="field-label">Players ({players.length})</div>
        <div className="players-edit">
          {players.map((p, i) => (
            <div className="row-edit" key={i} data-testid={`admin-team-${team.abbreviation}-player-${i}`}>
              <input
                className="input"
                value={p.name}
                onChange={e => updatePlayer(i, { name: e.target.value })}
                placeholder="Player name"
                data-testid={`admin-team-${team.abbreviation}-player-${i}-name`}
              />
              <input
                className="input player-utr-input"
                type="number"
                min="1"
                max="16.5"
                step="0.01"
                value={p.utr || ''}
                onChange={e => updatePlayer(i, { utr: e.target.value })}
                placeholder="UTR"
                data-testid={`admin-team-${team.abbreviation}-player-${i}-utr`}
              />
              <button
                type="button"
                className={`cap-badge ${i === 0 || p.isCaptain ? 'active' : ''}`}
                onClick={() => setCaptain(i)}
                data-testid={`admin-team-${team.abbreviation}-player-${i}-captain`}
              >🏆</button>
              <button type="button" className="del" onClick={() => removePlayer(i)} data-testid={`admin-team-${team.abbreviation}-player-${i}-del`}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn small ghost" style={{ marginTop: '.4rem' }} onClick={addPlayer} data-testid={`admin-team-${team.abbreviation}-add-player`}>
          + Add Player
        </button>
      </div>

      <p className="hint">Saving syncs team/player name changes into existing match records and recalculates standings, ratings, histories, eligibility, and dashboard summaries.</p>
      {savedMsg && <div className={savedMsg.startsWith('✅') ? 'success-box' : 'error-box'}>{savedMsg}</div>}

      <button className="btn full success" onClick={save} data-testid={`admin-team-${team.abbreviation}-save`}>Save Team & Sync Names</button>
    </div>
  );
}

function ScheduleEditor({ schedule, teams }) {
  const [editing, setEditing] = useState({}); // matchId -> draft
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const matchList = Object.values(schedule || {}).filter(item => item?.type !== 'buffer');

  // Group by round
  const rounds = {};
  matchList.forEach(m => {
    const key = `${m.round}-${m.date}`;
    if (!rounds[key]) rounds[key] = { round: m.round, date: m.date, items: [] };
    rounds[key].items.push(m);
  });
  const roundList = Object.values(rounds).sort((a, b) => (a.round - b.round) || a.date.localeCompare(b.date));

  const setDraft = (id, patch) => {
    setEditing(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const saveMatch = async (m) => {
    const draft = editing[m.id] || {};
    const updates = {};
    ['date', 'time', 'team1Id', 'team2Id', 'status', 'group', 'round'].forEach(k => {
      if (draft[k] !== undefined && draft[k] !== m[k]) updates[k] = draft[k];
    });
    if (Object.keys(updates).length === 0) { setMsg('Nothing to save'); return; }
    try {
      setBusy(true);
      await update(ref(db, `${PATHS.schedule}/${m.id}`), updates);
      setMsg(`✅ Saved ${m.id}`);
      setEditing(prev => { const c = { ...prev }; delete c[m.id]; return c; });
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('Save failed: ' + e.message);
    } finally { setBusy(false); }
  };

  const deleteMatch = async (m) => {
    if (!window.confirm(`Delete fixture ${m.id}?`)) return;
    try { await remove(ref(db, `${PATHS.schedule}/${m.id}`)); } catch (e) { alert(e.message); }
  };

  const addMatch = async () => {
    if (teamList.length < 2) return;
    const newM = {
      group: 'A',
      round: 1,
      date: new Date().toISOString().slice(0, 10),
      time: '7:15 PM',
      team1Id: teamList[0].id,
      team2Id: teamList[1].id,
      status: 'scheduled',
      type: 'match'
    };
    try {
      const r = await push(ref(db, PATHS.schedule), newM);
      // Patch with its own key as `id`
      await update(ref(db, `${PATHS.schedule}/${r.key}`), { id: r.key });
      setMsg('✅ Added fixture');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) { setMsg('Add failed: ' + e.message); }
  };

  const regenerate = async () => {
    if (!window.confirm('Regenerate the entire schedule from scratch? Existing fixtures will be replaced.')) return;
    const list = Object.values(teams);
    const groupA = list.filter(t => (t.group || 'A') === 'A').sort(sortByGroupOrder);
    const groupB = list.filter(t => t.group === 'B').sort(sortByGroupOrder);
    if (groupA.length !== 8 || groupB.length !== 8) { setMsg('Need exactly 8 teams in each group.'); return; }
    try {
      setBusy(true);
      const fixtures = buildScheduleFor8x2(groupA, groupB);
      await set(ref(db, PATHS.schedule), fixtures);
      setMsg('✅ Schedule regenerated');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('Regenerate failed: ' + e.message);
    } finally { setBusy(false); }
  };

  const clearAll = async () => {
    if (!window.confirm('Delete ALL fixtures? Cannot be undone.')) return;
    try { await remove(ref(db, PATHS.schedule)); } catch (e) { alert(e.message); }
  };

  return (
    <div data-testid="schedule-editor">
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}

      <div className="card">
        <h2>Schedule Tools</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
          <button className="btn small" onClick={regenerate} disabled={busy} data-testid="admin-schedule-regenerate">🔁 Regenerate KOC3 Schedule</button>
          <button className="btn small ghost" onClick={addMatch} data-testid="admin-schedule-add">＋ Add Fixture</button>
          <button className="btn small danger" onClick={clearAll} data-testid="admin-schedule-clear">🗑 Clear All</button>
        </div>
        <p className="hint" style={{ marginTop: '.5rem' }}>{matchList.filter(m => m.type !== 'buffer').length} fixtures · Group A Saturdays, Group B Sundays, with July 4 buffer week.</p>
      </div>

      {roundList.length === 0 && (
        <div className="card center muted" data-testid="admin-schedule-empty">No fixtures yet. Click "Regenerate" to seed.</div>
      )}

      {roundList.map(r => (
        <div className="card" key={`${r.round}-${r.date}`} data-testid={`admin-schedule-round-${r.round}`}>
          <h2>Round {r.round} · {r.date}</h2>
          {r.items
            .sort((a, b) => a.group.localeCompare(b.group) || a.time.localeCompare(b.time))
            .map(m => {
              const draft = editing[m.id] || {};
              const get = (k) => draft[k] !== undefined ? draft[k] : m[k];
              return (
                <div key={m.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '.55rem', marginBottom: '.45rem', borderLeft: `3px solid ${m.group === 'A' ? '#2563eb' : '#d97706'}` }} data-testid={`admin-fixture-${m.id}`}>
                  <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.35rem' }}>
                    <select className="select" value={get('group')} onChange={e => setDraft(m.id, { group: e.target.value })} data-testid={`admin-fixture-${m.id}-group`} style={{ flex: '0 0 80px' }}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                    <input className="input" type="number" min="1" max="20" value={get('round')} onChange={e => setDraft(m.id, { round: Number(e.target.value) })} data-testid={`admin-fixture-${m.id}-round`} style={{ flex: '0 0 70px' }} />
                    <input className="input" type="date" value={get('date')} onChange={e => setDraft(m.id, { date: e.target.value })} data-testid={`admin-fixture-${m.id}-date`} style={{ flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.35rem' }}>
                    <input className="input" value={get('time')} onChange={e => setDraft(m.id, { time: e.target.value })} placeholder="Time" data-testid={`admin-fixture-${m.id}-time`} style={{ flex: 1 }} />
                    <select className="select" value={get('status')} onChange={e => setDraft(m.id, { status: e.target.value })} data-testid={`admin-fixture-${m.id}-status`} style={{ flex: 1 }}>
                      <option value="scheduled">scheduled</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.35rem' }}>
                    <select className="select" value={get('team1Id')} onChange={e => setDraft(m.id, { team1Id: e.target.value })} data-testid={`admin-fixture-${m.id}-t1`} style={{ flex: 1 }}>
                      {teamList.map(t => <option key={t.id} value={t.id}>{t.abbreviation} · {t.name}</option>)}
                    </select>
                    <span style={{ alignSelf: 'center', fontWeight: 800, color: 'var(--muted)' }}>vs</span>
                    <select className="select" value={get('team2Id')} onChange={e => setDraft(m.id, { team2Id: e.target.value })} data-testid={`admin-fixture-${m.id}-t2`} style={{ flex: 1 }}>
                      {teamList.map(t => <option key={t.id} value={t.id}>{t.abbreviation} · {t.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '.35rem' }}>
                    <button className="btn small success" onClick={() => saveMatch(m)} disabled={busy} data-testid={`admin-fixture-${m.id}-save`}>Save</button>
                    <button className="btn small danger" onClick={() => deleteMatch(m)} data-testid={`admin-fixture-${m.id}-del`}>Delete</button>
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function AdminLineupManager({ teams, schedule, lineupSubmissions, revealedLineups }) {
  const { session } = useAuth();
  const [busyKey, setBusyKey] = useState('');
  const fixtures = Object.values(schedule || {}).filter(item => item?.type !== 'buffer');
  const unlock = async (fixture, teamId, submission) => {
    const reason = window.prompt('Reason for unlocking this lineup?');
    if (!reason?.trim()) return;
    const now = Date.now();
    const unlockId = `${fixture.id}-${teamId}-${now}`;
    const updates = {
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/unlockedAt`]: now,
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/unlockedBy`]: session?.userId || session?.name || 'SUPER_ADMIN',
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/unlockReason`]: reason.trim(),
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/submissionStatus`]: 'unlocked',
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/lastUpdatedAt`]: now,
      [`${PATHS.lineupSubmissions}/${fixture.id}/${teamId}/previousVersions/${submission?.version || 1}`]: { ...submission, archivedAt: now },
      [`${PATHS.lineupUnlocks}/${unlockId}`]: { scheduleId: fixture.id, teamId, unlockedAt: now, unlockedBy: session?.userId || session?.name || 'SUPER_ADMIN', reason: reason.trim(), previousVersion: submission?.version || 1 }
    };
    try {
      setBusyKey(`${fixture.id}-${teamId}`);
      await update(ref(db), updates);
      await writeAuditLog({ actionType: 'Lineup Unlocked', session, targetType: 'schedule', targetId: fixture.id, newValue: updates[`${PATHS.lineupUnlocks}/${unlockId}`] });
    } finally {
      setBusyKey('');
    }
  };

  const deleteFixtureLineups = async (fixture, submissions, reveal) => {
    const reason = window.prompt('Reason for deleting/resetting these lineup references? Captains will be able to submit fresh lineups.');
    if (!reason?.trim()) return;
    if (!window.confirm('Confirm reset: active lineup submissions and revealed lineup reference for this schedule will be removed from active views and archived to audit history.')) return;
    const now = Date.now();
    const deleteId = `${fixture.id}-${now}`;
    const deleteRecord = {
      scheduleId: fixture.id,
      deletedAt: now,
      deletedBy: session?.userId || session?.name || 'SUPER_ADMIN',
      reason: reason.trim(),
      previousSubmissions: submissions || {},
      previousReveal: reveal || null
    };
    const updates = {
      [`${PATHS.lineupDeletes}/${deleteId}`]: deleteRecord,
      [`${PATHS.lineupSubmissions}/${fixture.id}`]: null
    };
    if (reveal?.revealId) updates[`${PATHS.revealedLineups}/${reveal.revealId}`] = null;
    try {
      setBusyKey(`${fixture.id}-delete`);
      await update(ref(db), updates);
      await writeAuditLog({ actionType: 'Lineup References Deleted', session, targetType: 'schedule', targetId: fixture.id, oldValue: { submissions, reveal }, newValue: deleteRecord });
    } finally {
      setBusyKey('');
    }
  };
  return (
    <div className="card" data-testid="admin-lineup-manager">
      <h2>🔐 Lineup Submissions</h2>
      <p className="hint">Before reveal, Super Admin sees only submission status, timestamps, WhatsApp status, and audit/unlock metadata. Player names appear only after reveal.</p>
      <div style={{ display: 'grid', gap: '.65rem' }}>
        {fixtures.map(fixture => {
          const submissions = lineupSubmissions?.[fixture.id] || {};
          const reveal = Object.values(revealedLineups || {}).find(row => row.scheduleId === fixture.id);
          return (
            <div key={fixture.id} className="captain-fixture-card">
              <strong>{teams[fixture.team1Id]?.name || 'Team 1'} vs {teams[fixture.team2Id]?.name || 'Team 2'}</strong>
              <div className="hint">Schedule ID: {fixture.id} {reveal?.revealCode ? `· Reveal code ${reveal.revealCode}` : ''}</div>
              {(Object.keys(submissions).length > 0 || reveal) && <button className="btn small danger" disabled={busyKey === `${fixture.id}-delete`} onClick={() => deleteFixtureLineups(fixture, submissions, reveal)} data-testid={`admin-delete-lineups-${fixture.id}`}>Delete lineup refs</button>}
              {[fixture.team1Id, fixture.team2Id].map(teamId => {
                const submission = submissions[teamId] || {};
                const locked = !!submission.lockedAt && !submission.unlockedAt;
                return (
                  <div key={teamId} className="rl-item" style={{ marginTop: '.45rem' }}>
                    <span className="rl-ic">🔒</span>
                    <div style={{ flex: 1 }}>
                      <div className="rl-lbl">{teams[teamId]?.name || teamId}</div>
                      <div className="rl-val">Status: {submission.submissionStatus || 'not_submitted'} · Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'} · WhatsApp: {submission.whatsappShared ? 'Shared' : 'Not Shared'}</div>
                      {submission.unlockedAt && <div className="hint">Unlocked: {new Date(submission.unlockedAt).toLocaleString()} · {submission.unlockReason}</div>}
                      {reveal && <div className="hint">Revealed lineup available in score entry with code {reveal.revealCode}.</div>}
                    </div>
                    {locked && <button className="btn small danger" disabled={busyKey === `${fixture.id}-${teamId}`} onClick={() => unlock(fixture, teamId, submission)}>Unlock</button>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Admin({ teams, adminConfig, matches, previousMatches = [], schedule, lineupSubmissions = {}, revealedLineups = {}, playerRatings = {}, settings = {} }) {
  const [tab, setTab] = useState('teams');
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [rulesDraft, setRulesDraft] = useState(() => normalizeEligibilityRules(settings.eligibilityRules));

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const currentRules = useMemo(() => normalizeEligibilityRules(settings.eligibilityRules), [settings.eligibilityRules]);
  React.useEffect(() => { setRulesDraft(currentRules); }, [currentRules]);

  const saveAdminPwd = async () => {
    if (!newAdminPwd.trim()) { setAdminMsg('Password cannot be empty.'); return; }
    try {
      await update(ref(db, PATHS.admin), { password: newAdminPwd.trim() });
      setAdminMsg('✅ Admin password updated');
      setNewAdminPwd('');
      setTimeout(() => setAdminMsg(''), 2000);
    } catch (e) {
      setAdminMsg('Save failed: ' + e.message);
    }
  };


  const saveEligibilityRules = async () => {
    const next = normalizeEligibilityRules(rulesDraft);
    try {
      await update(ref(db, PATHS.settings), { eligibilityRules: next });
      setAdminMsg('✅ Eligibility rules updated');
      setTimeout(() => setAdminMsg(''), 2000);
    } catch (e) {
      setAdminMsg('Save failed: ' + e.message);
    }
  };

  const handleClearMatches = async () => {
    if (!window.confirm('Delete ALL match results? This cannot be undone.')) return;
    try {
      await remove(ref(db, PATHS.matches));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  return (
    <main className="container">
      <div className="page-title">
        <h1>Admin Dashboard</h1>
        <p>Manage teams, passwords, and matches</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')} data-testid="admin-tab-teams">Teams</button>
        <button className={`tab ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')} data-testid="admin-tab-schedule">Schedule</button>
        <button className={`tab ${tab === 'lineups' ? 'active' : ''}`} onClick={() => setTab('lineups')} data-testid="admin-tab-lineups">Lineups</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} data-testid="admin-tab-settings">Settings</button>
        <button className={`tab ${tab === 'nameMapping' ? 'active' : ''}`} onClick={() => setTab('nameMapping')} data-testid="admin-tab-name-mapping">PTL Name Mapping</button>
        <button className={`tab ${tab === 'passwords' ? 'active' : ''}`} onClick={() => setTab('passwords')} data-testid="admin-tab-passwords">Passwords</button>
      </div>

      {tab === 'teams' && (
        <>
          <TeamJsonImporter />
          {teamList.map(t => <TeamEditor key={t.id} team={t} matches={matches} />)}
        </>
      )}

      {tab === 'schedule' && <ScheduleEditor schedule={schedule} teams={teams} />}

      {tab === 'lineups' && <AdminLineupManager teams={teams} schedule={schedule} lineupSubmissions={lineupSubmissions} revealedLineups={revealedLineups} />}

      {tab === 'nameMapping' && <NameMappingAdmin teams={teams} matches={matches} previousMatches={previousMatches} playerRatings={playerRatings} />}

      {tab === 'passwords' && (
        <div className="card">
          <h2>🔑 Team Passwords</h2>
          <p className="hint" style={{ marginBottom: '.6rem' }}>Share these with each team captain.</p>
          {teamList.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--ring)' }} data-testid={`admin-pwd-${t.abbreviation}`}>
              <div>
                <strong>{t.abbreviation}</strong> · {t.name}
              </div>
              <code style={{ background: '#f1f5f9', padding: '.2rem .5rem', borderRadius: 6, fontSize: '.85rem' }}>{t.password}</code>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <>
          <div className="card">
            <h2>🔐 Admin Password</h2>
            {adminMsg && <div className={adminMsg.startsWith('✅') ? 'success-box' : 'error-box'}>{adminMsg}</div>}
            <div className="field">
              <div className="field-label">Current</div>
              <input className="input" value={adminConfig?.password || ''} readOnly data-testid="admin-current-pwd" />
            </div>
            <div className="field">
              <div className="field-label">New Password</div>
              <input className="input" type="password" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} data-testid="admin-new-pwd" />
            </div>
            <button className="btn full" onClick={saveAdminPwd} data-testid="admin-save-pwd-btn">Update Admin Password</button>
          </div>


          <div className="card">
            <h2>🎾 Player Eligibility Rules</h2>
            <p className="hint" style={{ marginBottom: '.6rem' }}>Configure the Round Robin validation used before lineup/score submission and during score processing.</p>
            <div className="row">
              <div className="field">
                <div className="field-label">Max Singles Days</div>
                <input className="input" type="number" min="1" value={rulesDraft.maxSinglesDays} onChange={e => setRulesDraft({ ...rulesDraft, maxSinglesDays: e.target.value })} data-testid="eligibility-max-singles" />
              </div>
              <div className="field">
                <div className="field-label">Max Total Match Days</div>
                <input className="input" type="number" min="1" value={rulesDraft.maxTotalMatchDays} onChange={e => setRulesDraft({ ...rulesDraft, maxTotalMatchDays: e.target.value })} data-testid="eligibility-max-total" />
              </div>
              <div className="field">
                <div className="field-label">Max Same-Partner Days</div>
                <input className="input" type="number" min="1" value={rulesDraft.maxPartnerDays} onChange={e => setRulesDraft({ ...rulesDraft, maxPartnerDays: e.target.value })} data-testid="eligibility-max-partner" />
              </div>
            </div>
            <button className="btn full" onClick={saveEligibilityRules} data-testid="admin-save-eligibility-rules">Save Eligibility Rules</button>
          </div>

          <div className="card">
            <h2>🗑️ Danger Zone</h2>
            <p className="hint" style={{ marginBottom: '.5rem' }}>{matches.length} match result{matches.length === 1 ? '' : 's'} on record.</p>
            <button className="btn full danger" onClick={handleClearMatches} data-testid="admin-clear-matches-btn">Clear All Match Results</button>
          </div>
        </>
      )}
    </main>
  );
}
