import React, { useMemo, useState } from 'react';
import { ref, set, update, remove, push } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { can, PERMISSIONS, ROLES, ROLE_LABELS, roleOf } from '../config/roles';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, logAudit } from '../utils/audit';
import { buildScheduleFor8x2 } from '../utils/roundRobin';
import { UTR_RATINGS, matchUtrRating, normalizeNameKey, suggestUtrMatches } from '../data/utrRatings';
import { groupInfoForTeamId, normalizeAuctionTeam, sortByGroupOrder } from '../data/auctionTeams';


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

function AdminNameMapRow({ sourceName, sourceInfo, lookupRows, session }) {
  const suggestions = useMemo(() => suggestUtrMatches(sourceName, lookupRows, 5), [sourceName, lookupRows]);
  const [targetName, setTargetName] = useState(suggestions[0]?.row.fullName || lookupRows[0]?.fullName || '');
  const [msg, setMsg] = useState('');
  const targetRow = lookupRows.find(row => row.fullName === targetName) || suggestions[0]?.row;

  const saveMapping = async () => {
    if (!targetRow) { setMsg('Select an actual UTR player first.'); return; }
    const id = ratingRowId(targetRow);
    if (!id) { setMsg('Selected rating row has no Firebase id.'); return; }
    const keys = uniqueValues([...(targetRow.keys || []), normalizeNameKey(sourceName)]);
    try {
      await update(ref(db, `${PATHS.playerRatings}/${id}`), { keys, aliases: null });
      await logAudit(session, AUDIT_ACTIONS.RATING_RECALCULATION, {
        targetType: 'playerRating',
        targetId: id,
        newValue: { source: sourceName, mappedTo: targetRow.fullName }
      });
      setMsg(`✅ DB key updated: ${sourceName} → ${targetRow.fullName}`);
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

function NameMappingAdmin({ teams, matches, previousMatches, playerRatings, session }) {
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
      <h2>PPRC Name Mapping</h2>
      <p className="hint">Map roster, KOC3 match, and Season 2 names to actual UTR players. Clicking <strong>Update DB Mapping</strong> writes only normalized keys to /koc_s3/playerRatings; aliases are removed so the rating data stays clean.</p>
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
            {visibleRows.map(row => <AdminNameMapRow key={row.name} sourceName={row.name} sourceInfo={row} lookupRows={lookupRows} session={session} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
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

function TeamEditor({ team, session }) {
  const [name, setName] = useState(team.name);
  const [abbr, setAbbr] = useState(team.abbreviation);
  const [password, setPassword] = useState(team.password || '');
  const [group, setGroup] = useState(team.group || 'A');
  const [players, setPlayers] = useState(team.players || []);
  const [savedMsg, setSavedMsg] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const save = async () => {
    setSavedMsg('');
    if (!name.trim() || !abbr.trim()) { setSavedMsg('Name and abbreviation are required'); return; }
    if (!password.trim()) { setSavedMsg('Password required'); return; }
    const payload = {
      ...team,
      name: name.trim(),
      abbreviation: abbr.trim().toUpperCase(),
      password: password.trim(),
      group,
      players: players.filter(p => (p.name || '').trim()).map(p => {
        const utr = Number(p.utr);
        return {
          name: p.name.trim(),
          isCaptain: !!p.isCaptain,
          utr: p.utr === '' || p.utr == null || !Number.isFinite(utr) ? '' : utr
        };
      })
    };
    try {
      await set(ref(db, `${PATHS.teams}/${team.id}`), payload);
      await logAudit(session, AUDIT_ACTIONS.TEAM_EDIT, {
        targetType: 'team',
        targetId: team.id,
        oldValue: { name: team.name, abbreviation: team.abbreviation, group: team.group, playerCount: (team.players || []).length },
        newValue: { name: payload.name, abbreviation: payload.abbreviation, group: payload.group, playerCount: payload.players.length }
      });
      setSavedMsg('✅ Saved');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (e) {
      setSavedMsg('Save failed: ' + e.message);
    }
  };

  const addPlayer = () => setPlayers([...players, { name: '', isCaptain: false }]);
  const removePlayer = (i) => setPlayers(players.filter((_, j) => j !== i));
  const updatePlayer = (i, patch) => setPlayers(players.map((p, j) => j === i ? { ...p, ...patch } : p));
  const setCaptain = (i) => setPlayers(players.map((p, j) => ({ ...p, isCaptain: j === i })));

  return (
    <div className="card" data-testid={`admin-team-${team.abbreviation}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem' }}>
        <h2 style={{ margin: 0 }}>{name || team.name}</h2>
        <span className={`team-grad-${team.gradient || 1} abbr`} style={{ color: '#fff', padding: '.25rem .6rem', borderRadius: 999, fontWeight: 800, fontSize: '.75rem' }}>{abbr}</span>
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
                className={`cap-badge ${p.isCaptain ? 'active' : ''}`}
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

      {savedMsg && <div className={savedMsg.startsWith('✅') ? 'success-box' : 'error-box'}>{savedMsg}</div>}

      <button className="btn full success" onClick={save} data-testid={`admin-team-${team.abbreviation}-save`}>Save Team</button>
    </div>
  );
}

function ScheduleEditor({ schedule, teams, session }) {
  const [editing, setEditing] = useState({}); // matchId -> draft
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const canDeleteCore = can(session, PERMISSIONS.DELETE_CORE_DATA);

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
      await logAudit(session, AUDIT_ACTIONS.SCHEDULE_EDIT, { targetType: 'fixture', targetId: m.id, newValue: updates });
      setMsg(`✅ Saved ${m.id}`);
      setEditing(prev => { const c = { ...prev }; delete c[m.id]; return c; });
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('Save failed: ' + e.message);
    } finally { setBusy(false); }
  };

  const deleteMatch = async (m) => {
    if (!canDeleteCore) { setMsg('Only a Super Admin can delete fixtures.'); return; }
    if (!window.confirm(`Delete fixture ${m.id}?`)) return;
    try {
      await remove(ref(db, `${PATHS.schedule}/${m.id}`));
      await logAudit(session, AUDIT_ACTIONS.SCHEDULE_DELETE, { targetType: 'fixture', targetId: m.id, oldValue: { team1Id: m.team1Id, team2Id: m.team2Id, date: m.date } });
    } catch (e) { alert(e.message); }
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
      await logAudit(session, AUDIT_ACTIONS.SCHEDULE_ADD, { targetType: 'fixture', targetId: r.key, newValue: newM });
      setMsg('✅ Added fixture');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) { setMsg('Add failed: ' + e.message); }
  };

  const regenerate = async () => {
    if (!canDeleteCore) { setMsg('Only a Super Admin can regenerate the schedule.'); return; }
    if (!window.confirm('Regenerate the entire schedule from scratch? Existing fixtures will be replaced.')) return;
    const list = Object.values(teams);
    const groupA = list.filter(t => (t.group || 'A') === 'A').sort(sortByGroupOrder);
    const groupB = list.filter(t => t.group === 'B').sort(sortByGroupOrder);
    if (groupA.length !== 8 || groupB.length !== 8) { setMsg('Need exactly 8 teams in each group.'); return; }
    try {
      setBusy(true);
      const fixtures = buildScheduleFor8x2(groupA, groupB);
      await set(ref(db, PATHS.schedule), fixtures);
      await logAudit(session, AUDIT_ACTIONS.SCHEDULE_EDIT, { targetType: 'schedule', targetId: 'all', newValue: { regenerated: true, fixtures: Object.keys(fixtures).length } });
      setMsg('✅ Schedule regenerated');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('Regenerate failed: ' + e.message);
    } finally { setBusy(false); }
  };

  const clearAll = async () => {
    if (!canDeleteCore) { setMsg('Only a Super Admin can clear all fixtures.'); return; }
    if (!window.confirm('Delete ALL fixtures? Cannot be undone.')) return;
    try {
      await remove(ref(db, PATHS.schedule));
      await logAudit(session, AUDIT_ACTIONS.SCHEDULE_DELETE, { targetType: 'schedule', targetId: 'all', oldValue: { cleared: true } });
    } catch (e) { alert(e.message); }
  };

  return (
    <div data-testid="schedule-editor">
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}

      <div className="card">
        <h2>Schedule Tools</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
          {canDeleteCore && <button className="btn small" onClick={regenerate} disabled={busy} data-testid="admin-schedule-regenerate">🔁 Regenerate KOC3 Schedule</button>}
          <button className="btn small ghost" onClick={addMatch} data-testid="admin-schedule-add">＋ Add Fixture</button>
          {canDeleteCore && <button className="btn small danger" onClick={clearAll} data-testid="admin-schedule-clear">🗑 Clear All</button>}
        </div>
        {!canDeleteCore && <p className="hint" style={{ marginTop: '.5rem' }}>Regenerate and Clear All are restricted to Super Admin.</p>}
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
                    {canDeleteCore && <button className="btn small danger" onClick={() => deleteMatch(m)} data-testid={`admin-fixture-${m.id}-del`}>Delete</button>}
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function ScoresApproval({ matches, teams, session }) {
  const [msg, setMsg] = useState('');
  const pending = (matches || []).filter(m => m.status === 'pending');

  const decide = async (m, approve) => {
    try {
      await update(ref(db, `${PATHS.matches}/${m.id}`), { status: approve ? 'approved' : 'rejected' });
      await logAudit(session, approve ? AUDIT_ACTIONS.SCORE_APPROVAL : AUDIT_ACTIONS.SCORE_REJECTION, {
        targetType: 'match',
        targetId: m.id,
        oldValue: { status: m.status || 'pending' },
        newValue: { status: approve ? 'approved' : 'rejected' }
      });
      setMsg(`✅ ${approve ? 'Approved' : 'Rejected'}: ${m.t1} vs ${m.t2}`);
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Action failed: ' + e.message);
    }
  };

  return (
    <div data-testid="admin-scores-approval">
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}
      <div className="card">
        <h2>🧾 Pending Scores</h2>
        <p className="hint">Captain-entered results awaiting approval. Approve to count them; reject disputed scores.</p>
        {pending.length === 0 && <div className="center muted" data-testid="admin-scores-empty">No pending scores.</div>}
        {pending.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', padding: '.55rem 0', borderBottom: '1px solid var(--ring)' }} data-testid={`admin-pending-${m.id}`}>
            <div>
              <strong>{m.t1} vs {m.t2}</strong>
              <div className="muted" style={{ fontSize: '.8rem' }}>Winner: {m.win || '—'} · Courts {m.courtsWon1}-{m.courtsWon2} · by {m.enteredBy || 'Unknown'}</div>
            </div>
            <div style={{ display: 'flex', gap: '.35rem' }}>
              <button className="btn small success" onClick={() => decide(m, true)} data-testid={`admin-approve-${m.id}`}>Approve</button>
              <button className="btn small danger" onClick={() => decide(m, false)} data-testid={`admin-reject-${m.id}`}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminUsersManager({ adminUsers, session }) {
  const [msg, setMsg] = useState('');
  const [newUser, setNewUser] = useState({ username: '', name: '', role: ROLES.ADMIN, password: '' });
  const users = Object.entries(adminUsers || {}).map(([username, u]) => ({ username, ...(u || {}) }));

  const changeRole = async (username, oldUser, role) => {
    try {
      await update(ref(db, `${PATHS.adminUsers}/${username}`), { role });
      await logAudit(session, AUDIT_ACTIONS.ADMIN_ROLE_CHANGE, {
        targetType: 'adminUser',
        targetId: username,
        oldValue: { role: oldUser.role },
        newValue: { role }
      });
      setMsg(`✅ Updated role for ${username}`);
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Update failed: ' + e.message);
    }
  };

  const addUser = async () => {
    const username = newUser.username.trim().toLowerCase();
    if (!username || !newUser.password.trim()) { setMsg('Username and password are required.'); return; }
    try {
      await set(ref(db, `${PATHS.adminUsers}/${username}`), {
        name: newUser.name.trim() || username,
        role: newUser.role,
        password: newUser.password.trim()
      });
      await logAudit(session, AUDIT_ACTIONS.ADMIN_ROLE_CHANGE, {
        targetType: 'adminUser',
        targetId: username,
        newValue: { role: newUser.role, created: true }
      });
      setMsg(`✅ Added ${username}`);
      setNewUser({ username: '', name: '', role: ROLES.ADMIN, password: '' });
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Add failed: ' + e.message);
    }
  };

  const removeUser = async (u) => {
    if (u.username === session?.username) { setMsg('You cannot remove your own account.'); return; }
    if (!window.confirm(`Remove admin user ${u.username}?`)) return;
    try {
      await remove(ref(db, `${PATHS.adminUsers}/${u.username}`));
      await logAudit(session, AUDIT_ACTIONS.ADMIN_ROLE_CHANGE, {
        targetType: 'adminUser',
        targetId: u.username,
        oldValue: { role: u.role },
        newValue: { removed: true }
      });
    } catch (e) {
      setMsg('Remove failed: ' + e.message);
    }
  };

  return (
    <div data-testid="admin-users-manager">
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}
      <div className="card">
        <h2>🛡️ Admin & Captain Roles</h2>
        <p className="hint">Manage admin accounts and their roles. Captains sign in with their team password.</p>
        <div className="table-wrap">
          <table className="std" data-testid="admin-users-table">
            <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} data-testid={`admin-user-${u.username}`}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.name || '—'}</td>
                  <td>
                    <select className="select" value={u.role} onChange={e => changeRole(u.username, u, e.target.value)} data-testid={`admin-user-${u.username}-role`}>
                      <option value={ROLES.SUPER_ADMIN}>{ROLE_LABELS.SUPER_ADMIN}</option>
                      <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
                    </select>
                  </td>
                  <td><button className="btn small danger" onClick={() => removeUser(u)} data-testid={`admin-user-${u.username}-remove`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>➕ Add Admin User</h2>
        <div className="field">
          <div className="field-label">Username</div>
          <input className="input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} data-testid="admin-user-new-username" />
        </div>
        <div className="field">
          <div className="field-label">Display Name</div>
          <input className="input" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} data-testid="admin-user-new-name" />
        </div>
        <div className="field">
          <div className="field-label">Role</div>
          <select className="select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} data-testid="admin-user-new-role">
            <option value={ROLES.SUPER_ADMIN}>{ROLE_LABELS.SUPER_ADMIN}</option>
            <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
          </select>
        </div>
        <div className="field">
          <div className="field-label">Password</div>
          <input className="input" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} data-testid="admin-user-new-password" />
        </div>
        <button className="btn full success" onClick={addUser} data-testid="admin-user-add-btn">Add User</button>
      </div>
    </div>
  );
}

function AuditLogViewer({ auditLog }) {
  const [actionFilter, setActionFilter] = useState('all');
  const entries = auditLog || [];
  const actionTypes = Array.from(new Set(entries.map(e => e.actionType))).sort();
  const visible = actionFilter === 'all' ? entries : entries.filter(e => e.actionType === actionFilter);

  const describe = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="card" data-testid="admin-audit-log">
      <h2>📋 Audit Log</h2>
      <p className="hint">Full history of important actions performed by admins and captains. Visible to Super Admin only.</p>
      <div className="field">
        <div className="field-label">Filter by action</div>
        <select className="select" value={actionFilter} onChange={e => setActionFilter(e.target.value)} data-testid="admin-audit-filter">
          <option value="all">All actions ({entries.length})</option>
          {actionTypes.map(a => <option key={a} value={a}>{AUDIT_ACTION_LABELS[a] || a}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table className="std" data-testid="admin-audit-table">
          <thead>
            <tr><th>When</th><th>Action</th><th>By</th><th>Role</th><th>Target</th><th>Change</th></tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan="6" className="center muted">No audit entries yet.</td></tr>}
            {visible.map(e => (
              <tr key={e.id} data-testid={`admin-audit-row-${e.id}`}>
                <td><small>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</small></td>
                <td>{AUDIT_ACTION_LABELS[e.actionType] || e.actionType}</td>
                <td>{e.performedByName}</td>
                <td><span className="tag">{ROLE_LABELS[e.performedByRole] || e.performedByRole}</span></td>
                <td><small>{e.targetType ? `${e.targetType}${e.targetId ? `: ${e.targetId}` : ''}` : '—'}</small></td>
                <td><small className="muted">{[describe(e.oldValue), describe(e.newValue)].filter(Boolean).join(' → ')}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin({ teams, adminConfig, adminUsers = {}, auditLog = [], matches, previousMatches = [], schedule, playerRatings = {} }) {
  const { session } = useAuth();
  const role = roleOf(session);

  const allowed = useMemo(() => ({
    teams: can(session, PERMISSIONS.MANAGE_TEAMS),
    schedule: can(session, PERMISSIONS.MANAGE_SCHEDULE),
    scores: can(session, PERMISSIONS.APPROVE_SCORE),
    ratings: can(session, PERMISSIONS.MANAGE_RATINGS),
    passwords: can(session, PERMISSIONS.MANAGE_ADMINS),
    admins: can(session, PERMISSIONS.MANAGE_ADMINS),
    settings: can(session, PERMISSIONS.DELETE_CORE_DATA),
    audit: can(session, PERMISSIONS.VIEW_AUDIT)
  }), [session]);

  const tabs = useMemo(() => {
    const list = [];
    if (allowed.teams) list.push({ key: 'teams', label: 'Teams', testid: 'admin-tab-teams' });
    if (allowed.schedule) list.push({ key: 'schedule', label: 'Schedule', testid: 'admin-tab-schedule' });
    if (allowed.scores) list.push({ key: 'scores', label: 'Scores', testid: 'admin-tab-scores' });
    if (allowed.settings) list.push({ key: 'settings', label: 'Settings', testid: 'admin-tab-settings' });
    if (allowed.ratings) list.push({ key: 'nameMapping', label: 'PPRC Name Mapping', testid: 'admin-tab-name-mapping' });
    if (allowed.passwords) list.push({ key: 'passwords', label: 'Passwords', testid: 'admin-tab-passwords' });
    if (allowed.admins) list.push({ key: 'admins', label: 'Admins', testid: 'admin-tab-admins' });
    if (allowed.audit) list.push({ key: 'audit', label: 'Audit Log', testid: 'admin-tab-audit' });
    return list;
  }, [allowed]);

  const [tab, setTab] = useState(() => tabs[0]?.key || 'scores');
  const activeTab = tabs.some(t => t.key === tab) ? tab : (tabs[0]?.key || '');

  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  const saveAdminPwd = async () => {
    if (!allowed.settings) return;
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

  const handleClearMatches = async () => {
    if (!allowed.settings) return;
    if (!window.confirm('Delete ALL match results? This cannot be undone.')) return;
    try {
      await remove(ref(db, PATHS.matches));
      await logAudit(session, AUDIT_ACTIONS.SCORE_REJECTION, { targetType: 'matches', targetId: 'all', oldValue: { count: matches.length }, newValue: { cleared: true } });
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  return (
    <main className="container">
      <div className="page-title">
        <h1>Admin Dashboard</h1>
        <p>Signed in as <strong>{session?.adminName || 'Admin'}</strong> · <span className="tag" data-testid="admin-role-badge">{ROLE_LABELS[role] || role}</span></p>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)} data-testid={t.testid}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'teams' && allowed.teams && (
        <>
          <TeamJsonImporter />
          {teamList.map(t => <TeamEditor key={t.id} team={t} session={session} />)}
        </>
      )}

      {activeTab === 'schedule' && allowed.schedule && <ScheduleEditor schedule={schedule} teams={teams} session={session} />}

      {activeTab === 'scores' && allowed.scores && <ScoresApproval matches={matches} teams={teams} session={session} />}

      {activeTab === 'nameMapping' && allowed.ratings && <NameMappingAdmin teams={teams} matches={matches} previousMatches={previousMatches} playerRatings={playerRatings} session={session} />}

      {activeTab === 'passwords' && allowed.passwords && (
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

      {activeTab === 'admins' && allowed.admins && <AdminUsersManager adminUsers={adminUsers} session={session} />}

      {activeTab === 'audit' && allowed.audit && <AuditLogViewer auditLog={auditLog} />}

      {activeTab === 'settings' && allowed.settings && (
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
            <h2>🗑️ Danger Zone</h2>
            <p className="hint" style={{ marginBottom: '.5rem' }}>{matches.length} match result{matches.length === 1 ? '' : 's'} on record.</p>
            <button className="btn full danger" onClick={handleClearMatches} data-testid="admin-clear-matches-btn">Clear All Match Results</button>
          </div>
        </>
      )}
    </main>
  );
}
