import React, { useState } from 'react';
import { ref, set, update, remove } from 'firebase/database';
import { db, PATHS } from '../firebase';

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
      players: players.filter(p => (p.name || '').trim()).map(p => ({ name: p.name.trim(), isCaptain: !!p.isCaptain }))
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

export default function Admin({ teams, adminConfig, matches }) {
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
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} data-testid="admin-tab-settings">Settings</button>
        <button className={`tab ${tab === 'passwords' ? 'active' : ''}`} onClick={() => setTab('passwords')} data-testid="admin-tab-passwords">Passwords</button>
      </div>

      {tab === 'teams' && (
        <>
          {teamList.map(t => <TeamEditor key={t.id} team={t} />)}
        </>
      )}

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
            <h2>🗑️ Danger Zone</h2>
            <p className="hint" style={{ marginBottom: '.5rem' }}>{matches.length} match result{matches.length === 1 ? '' : 's'} on record.</p>
            <button className="btn full danger" onClick={handleClearMatches} data-testid="admin-clear-matches-btn">Clear All Match Results</button>
          </div>
        </>
      )}
    </main>
  );
}
