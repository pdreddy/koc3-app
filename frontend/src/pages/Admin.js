import React, { useState } from 'react';
import { ref, set, update, remove, push } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { buildScheduleFor8x2 } from '../utils/roundRobin';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, normalizeRole } from '../utils/roles';
import { ScoreProcessingService } from '../services/ScoreProcessingService';
import { groupInfoForTeamId, normalizeAuctionTeam, sortByGroupOrder } from '../data/auctionTeams';


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

function TeamEditor({ team }) {
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

export default function Admin({ teams, adminConfig, matches, schedule }) {
  const { session } = useAuth();
  const role = normalizeRole(session.role);
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const [tab, setTab] = useState('teams');
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

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

  const handleClearMatches = async () => {
    if (!window.confirm('Delete ALL match results? This cannot be undone.')) return;
    try {
      await remove(ref(db, PATHS.matches));
      await ScoreProcessingService.recalculateAll({ session });
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  return (
    <main className="container">
      <div className="page-title">
        <h1>Admin Dashboard</h1>
        <p>{isSuperAdmin ? 'Full league administration' : 'Operational admin tools'}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')} data-testid="admin-tab-teams">Teams</button>
        <button className={`tab ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')} data-testid="admin-tab-schedule">Schedule</button>
        {isSuperAdmin && <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} data-testid="admin-tab-settings">Settings</button>}
        {isSuperAdmin && <button className={`tab ${tab === 'passwords' ? 'active' : ''}`} onClick={() => setTab('passwords')} data-testid="admin-tab-passwords">Passwords</button>}
      </div>

      {tab === 'teams' && (
        <>
          <TeamJsonImporter />
          {teamList.map(t => <TeamEditor key={t.id} team={t} />)}
        </>
      )}

      {tab === 'schedule' && <ScheduleEditor schedule={schedule} teams={teams} />}


      {tab === 'passwords' && isSuperAdmin && (
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

      {tab === 'settings' && isSuperAdmin && (
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
