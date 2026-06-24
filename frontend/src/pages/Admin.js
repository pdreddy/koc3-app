import React, { useMemo, useState } from 'react';
import { ref, set, update, remove, push } from 'firebase/database';
import { db, PATHS, buildTenantPaths } from '../firebase';
import { buildScheduleFor8x2 } from '../utils/roundRobin';
import { UTR_RATINGS, matchUtrRating, normalizeNameKey, suggestUtrMatches } from '../data/utrRatings';
import { groupInfoForTeamId, normalizeAuctionTeam, sortByGroupOrder } from '../data/auctionTeams';
import { normalizeEligibilityRules } from '../utils/eligibilityRules';
import { DEFAULT_LEAGUE_CONFIG, DEFAULT_PLAYER_PROFILE_CONFIG, DEFAULT_SCHEDULE_CONFIG, DEFAULT_SCORING_CONFIG, DEFAULT_SEASON_SCOPE, normalizeLeagueConfig, normalizePlayerProfileConfig, normalizeScheduleConfig, normalizeScoringConfig, normalizeSeasonScope } from '../utils/leagueConfig';
import { buildConfigurableTeams, buildTournamentConfig, playerLookupRows } from '../utils/teamSetup';


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


function TeamSetupWizard({ teams, playerRatings }) {
  const [clubKey, setClubKey] = useState('koc');
  const [teamCount, setTeamCount] = useState(16);
  const [playersPerTeam, setPlayersPerTeam] = useState(7);
  const [groupsCount, setGroupsCount] = useState(2);
  const [tournamentName, setTournamentName] = useState('KOC Tournament');
  const [gameFormat, setGameFormat] = useState('miniSet4');
  const [gamesPerSet, setGamesPerSet] = useState(4);
  const [setCount, setSetCount] = useState(3);
  const [noAd, setNoAd] = useState(true);
  const [minPlaysPerPlayer, setMinPlaysPerPlayer] = useState(1);
  const [maxPlaysPerPlayer, setMaxPlaysPerPlayer] = useState(6);
  const [namesText, setNamesText] = useState('');
  const [msg, setMsg] = useState('');
  const lookupRows = useMemo(() => playerLookupRows(playerRatings), [playerRatings]);

  const playerNamesByTeam = useMemo(() => {
    return namesText.split('\n\n').map(block => block.split('\n').map(name => name.trim()).filter(Boolean));
  }, [namesText]);

  const previewTeams = useMemo(() => buildConfigurableTeams({
    clubKey,
    teamCount,
    playersPerTeam,
    groupsCount,
    playerNamesByTeam,
    lookupRows,
    existingTeams: teams
  }), [clubKey, groupsCount, lookupRows, playerNamesByTeam, playersPerTeam, teamCount, teams]);
  const tournamentConfig = useMemo(() => buildTournamentConfig({ clubKey, tournamentName, gameFormat, teamCount, playersPerTeam, groupsCount, gamesPerSet, setCount, noAd, minPlaysPerPlayer, maxPlaysPerPlayer }), [clubKey, gameFormat, gamesPerSet, groupsCount, maxPlaysPerPlayer, minPlaysPerPlayer, noAd, playersPerTeam, setCount, teamCount, tournamentName]);

  const saveTeams = async () => {
    setMsg('');
    if (!window.confirm(`Create/update ${teamCount} teams with ${playersPerTeam} player slots each? Existing matching slots are preserved.`)) return;
    try {
      await set(ref(db, PATHS.teams), previewTeams);
      await update(ref(db, PATHS.settings), tournamentConfig);
      setMsg(`✅ Created ${Object.keys(previewTeams).length} ${clubKey.toUpperCase()} team shells and saved ${tournamentConfig.leagueConfig.gameStyle} settings.`);
    } catch (e) {
      setMsg('Save failed: ' + e.message);
    }
  };

  return (
    <div className="card" data-testid="admin-team-setup-wizard">
      <h2>🏗️ Create Tournament</h2>
      <p className="hint">Create a tournament for KOC or Triace: choose teams, players per team, game format, no-ad rules, and min/max player play settings. Then use placeholders, paste names, or exact-match database players.</p>
      <div className="field"><div className="field-label">Tournament Name</div><input className="input" value={tournamentName} onChange={e => setTournamentName(e.target.value)} data-testid="team-setup-tournament-name" /></div>
      <div className="league-config-grid">
        <div className="field"><div className="field-label">Club preset</div><select className="select" value={clubKey} onChange={e => setClubKey(e.target.value)} data-testid="team-setup-club"><option value="koc">KOC</option><option value="triace">Triace</option></select></div>
        <div className="field"><div className="field-label">Number of Teams</div><input className="input" type="number" min="1" max="64" value={teamCount} onChange={e => setTeamCount(e.target.value)} data-testid="team-setup-team-count" /></div>
        <div className="field"><div className="field-label">Players / Team</div><input className="input" type="number" min="1" max="30" value={playersPerTeam} onChange={e => setPlayersPerTeam(e.target.value)} data-testid="team-setup-players-per-team" /></div>
        <div className="field"><div className="field-label">Groups</div><input className="input" type="number" min="1" max="8" value={groupsCount} onChange={e => setGroupsCount(e.target.value)} data-testid="team-setup-groups" /></div>
      </div>
      <div className="league-config-grid">
        <div className="field"><div className="field-label">Game Format</div><select className="select" value={gameFormat} onChange={e => { setGameFormat(e.target.value); if (e.target.value === 'regular6') { setGamesPerSet(6); setSetCount(3); setNoAd(false); } else if (e.target.value === 'proSet8') { setGamesPerSet(8); setSetCount(1); setNoAd(false); } else { setGamesPerSet(4); setSetCount(3); setNoAd(true); } }} data-testid="team-setup-game-format"><option value="miniSet4">Mini set · 4 games</option><option value="regular6">Regular set · 6 games</option><option value="proSet8">Pro set · 8 games</option></select></div>
        <div className="field"><div className="field-label">Games / Set</div><input className="input" type="number" min="1" max="8" value={gamesPerSet} onChange={e => setGamesPerSet(e.target.value)} data-testid="team-setup-games-per-set" /></div>
        <div className="field"><div className="field-label">Sets / Line</div><input className="input" type="number" min="1" max="5" value={setCount} onChange={e => setSetCount(e.target.value)} data-testid="team-setup-set-count" /></div>
        <div className="field"><div className="field-label">No-Ad Scoring</div><select className="select" value={noAd ? 'yes' : 'no'} onChange={e => setNoAd(e.target.value === 'yes')} data-testid="team-setup-no-ad"><option value="yes">Yes</option><option value="no">No</option></select></div>
        <div className="field"><div className="field-label">Min Plays / Player</div><input className="input" type="number" min="0" value={minPlaysPerPlayer} onChange={e => setMinPlaysPerPlayer(e.target.value)} data-testid="team-setup-min-plays" /></div>
        <div className="field"><div className="field-label">Max Plays / Player</div><input className="input" type="number" min="1" value={maxPlaysPerPlayer} onChange={e => setMaxPlaysPerPlayer(e.target.value)} data-testid="team-setup-max-plays" /></div>
      </div>
      <div className="field">
        <div className="field-label">Optional manual player names</div>
        <textarea className="textarea" value={namesText} onChange={e => setNamesText(e.target.value)} placeholder={'Team 1 player names, one per line\n\nTeam 2 player names, one per line'} data-testid="team-setup-player-names" />
        <p className="hint">Separate teams with a blank line. Exact matches against the player rating database will prefill UTR; unmatched names remain manual entries and can be mapped later in PTL Name Mapping.</p>
      </div>
      <div className="team-setup-preview">
        <strong>Preview:</strong> {Object.keys(previewTeams).length} teams · {Object.values(previewTeams).reduce((sum, team) => sum + team.players.length, 0)} roster slots · {tournamentConfig.leagueConfig.gameStyle} · {noAd ? 'No-Ad' : 'Regular ads'} · Min/Max plays {minPlaysPerPlayer}/{maxPlaysPerPlayer} · {lookupRows.length} database players available for exact lookup
      </div>
      <div className="table-wrap" style={{ marginTop: '.6rem' }}>
        <table className="std">
          <thead><tr><th>Team</th><th>Group</th><th>Players</th><th>Captain Slot</th></tr></thead>
          <tbody>{Object.values(previewTeams).slice(0, 8).map(team => <tr key={team.id}><td><strong>{team.abbreviation}</strong> · {team.name}</td><td>{team.group}</td><td>{team.players.length}</td><td>{team.players[0]?.name}</td></tr>)}</tbody>
        </table>
      </div>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'} style={{ marginTop: '.6rem' }}>{msg}</div>}
      <button className="btn full success" onClick={saveTeams} data-testid="team-setup-save">Create / Update Tournament</button>
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
      time: '5:00 PM',
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

export default function Admin({ teams, adminConfig, matches, previousMatches = [], schedule, playerRatings = {}, settings = {}, tenantScope = {}, onTenantScopeChange }) {
  const [tab, setTab] = useState('teams');
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [rulesDraft, setRulesDraft] = useState(() => normalizeEligibilityRules(settings.eligibilityRules));
  const [leagueDraft, setLeagueDraft] = useState(() => normalizeLeagueConfig(settings.leagueConfig));
  const [scoringDraft, setScoringDraft] = useState(() => normalizeScoringConfig(settings.scoringConfig));
  const [seasonDraft, setSeasonDraft] = useState(() => normalizeSeasonScope(settings.seasonScope));
  const [profileDraft, setProfileDraft] = useState(() => normalizePlayerProfileConfig(settings.playerProfileConfig));
  const [scheduleDraft, setScheduleDraft] = useState(() => normalizeScheduleConfig(settings.scheduleConfig));

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const currentRules = useMemo(() => normalizeEligibilityRules(settings.eligibilityRules), [settings.eligibilityRules]);
  React.useEffect(() => { setRulesDraft(currentRules); }, [currentRules]);
  const currentLeagueConfig = useMemo(() => normalizeLeagueConfig(settings.leagueConfig), [settings.leagueConfig]);
  React.useEffect(() => { setLeagueDraft(currentLeagueConfig); }, [currentLeagueConfig]);
  const currentScoringConfig = useMemo(() => normalizeScoringConfig(settings.scoringConfig), [settings.scoringConfig]);
  const currentSeasonScope = useMemo(() => normalizeSeasonScope(settings.seasonScope), [settings.seasonScope]);
  const currentProfileConfig = useMemo(() => normalizePlayerProfileConfig(settings.playerProfileConfig), [settings.playerProfileConfig]);
  const currentScheduleConfig = useMemo(() => normalizeScheduleConfig(settings.scheduleConfig), [settings.scheduleConfig]);
  React.useEffect(() => { setScoringDraft(currentScoringConfig); }, [currentScoringConfig]);
  React.useEffect(() => { setSeasonDraft(currentSeasonScope); }, [currentSeasonScope]);
  React.useEffect(() => { setProfileDraft(currentProfileConfig); }, [currentProfileConfig]);
  React.useEffect(() => { setScheduleDraft(currentScheduleConfig); }, [currentScheduleConfig]);

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


  const saveLeagueConfig = async () => {
    const next = normalizeLeagueConfig(leagueDraft);
    try {
      await update(ref(db, PATHS.settings), { leagueConfig: next });
      setAdminMsg('✅ League configuration updated');
      setTimeout(() => setAdminMsg(''), 2000);
    } catch (e) {
      setAdminMsg('Save failed: ' + e.message);
    }
  };

  const resetLeagueConfig = () => setLeagueDraft(DEFAULT_LEAGUE_CONFIG);

  const saveCommercialSettings = async () => {
    const nextSeasonScope = normalizeSeasonScope(seasonDraft);
    const targetPaths = buildTenantPaths(nextSeasonScope);
    try {
      await update(ref(db, targetPaths.settings), {
        scoringConfig: normalizeScoringConfig(scoringDraft),
        seasonScope: nextSeasonScope,
        playerProfileConfig: normalizePlayerProfileConfig(profileDraft),
        scheduleConfig: normalizeScheduleConfig(scheduleDraft)
      });
      if (onTenantScopeChange) onTenantScopeChange({ clubId: nextSeasonScope.clubId, seasonId: nextSeasonScope.seasonId });
      setAdminMsg(`✅ Commercial operations settings updated for ${nextSeasonScope.clubId}/${nextSeasonScope.seasonId}`);
      setTimeout(() => setAdminMsg(''), 2000);
    } catch (e) {
      setAdminMsg('Save failed: ' + e.message);
    }
  };

  const resetCommercialSettings = () => {
    setScoringDraft(DEFAULT_SCORING_CONFIG);
    setSeasonDraft(DEFAULT_SEASON_SCOPE);
    setProfileDraft(DEFAULT_PLAYER_PROFILE_CONFIG);
    setScheduleDraft(DEFAULT_SCHEDULE_CONFIG);
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
        <p>Manage teams, passwords, and matches · Active tenant: {(tenantScope.clubId || 'koc')}/{(tenantScope.seasonId || 'koc_s3')}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')} data-testid="admin-tab-teams">Teams</button>
        <button className={`tab ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')} data-testid="admin-tab-schedule">Schedule</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} data-testid="admin-tab-settings">Settings</button>
        <button className={`tab ${tab === 'nameMapping' ? 'active' : ''}`} onClick={() => setTab('nameMapping')} data-testid="admin-tab-name-mapping">PTL Name Mapping</button>
        <button className={`tab ${tab === 'passwords' ? 'active' : ''}`} onClick={() => setTab('passwords')} data-testid="admin-tab-passwords">Passwords</button>
      </div>

      {tab === 'teams' && (
        <>
          <TeamSetupWizard teams={teams} playerRatings={playerRatings} />
          <TeamJsonImporter />
          {teamList.map(t => <TeamEditor key={t.id} team={t} />)}
        </>
      )}

      {tab === 'schedule' && <ScheduleEditor schedule={schedule} teams={teams} />}

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



          <div className="card" data-testid="admin-league-config-card">
            <h2>🏢 Commercial League Configuration</h2>
            <p className="hint" style={{ marginBottom: '.6rem' }}>Make this app reusable for any club: brand it, choose game style, and control team/player limits without code changes.</p>
            <div className="row">
              <div className="field"><div className="field-label">League Name</div><input className="input" value={leagueDraft.leagueName} onChange={e => setLeagueDraft({ ...leagueDraft, leagueName: e.target.value })} data-testid="league-config-name" /></div>
              <div className="field"><div className="field-label">Club Name</div><input className="input" value={leagueDraft.clubName} onChange={e => setLeagueDraft({ ...leagueDraft, clubName: e.target.value })} data-testid="league-config-club" /></div>
            </div>
            <div className="row">
              <div className="field"><div className="field-label">Sport / Activity</div><input className="input" value={leagueDraft.sportName} onChange={e => setLeagueDraft({ ...leagueDraft, sportName: e.target.value })} data-testid="league-config-sport" /></div>
              <div className="field"><div className="field-label">Rating System</div><input className="input" value={leagueDraft.ratingSystemName} onChange={e => setLeagueDraft({ ...leagueDraft, ratingSystemName: e.target.value })} data-testid="league-config-rating" /></div>
            </div>
            <div className="field"><div className="field-label">Game Style</div><select className="select" value={leagueDraft.gameStyle} onChange={e => setLeagueDraft({ ...leagueDraft, gameStyle: e.target.value })} data-testid="league-config-game-style"><option>Round Robin + Playoffs</option><option>Round Robin Only</option><option>Knockout Bracket</option><option>Pool Play + Championship</option><option>Ladder / Flex League</option></select></div>
            <div className="league-config-grid">
              {[['teamCount', 'Teams'], ['groupsCount', 'Groups'], ['minPlayersPerTeam', 'Min Players / Team'], ['maxPlayersPerTeam', 'Max Players / Team'], ['activePlayersPerMatch', 'Active Players / Match'], ['linesPerMatch', 'Lines / Match'], ['singlesLines', 'Singles Lines'], ['playoffQualifiersPerGroup', 'Playoff Qualifiers / Group']].map(([key, label]) => (
                <div className="field" key={key}><div className="field-label">{label}</div><input className="input" type="number" min="1" value={leagueDraft[key]} onChange={e => setLeagueDraft({ ...leagueDraft, [key]: e.target.value })} data-testid={`league-config-${key}`} /></div>
              ))}
            </div>
            <div className="row">
              <div className="field"><div className="field-label">Season Start</div><input className="input" type="date" value={leagueDraft.regularSeasonStart} onChange={e => setLeagueDraft({ ...leagueDraft, regularSeasonStart: e.target.value })} data-testid="league-config-start" /></div>
              <div className="field"><div className="field-label">Season End</div><input className="input" type="date" value={leagueDraft.regularSeasonEnd} onChange={e => setLeagueDraft({ ...leagueDraft, regularSeasonEnd: e.target.value })} data-testid="league-config-end" /></div>
            </div>
            <div className="row">
              <div className="field"><div className="field-label">Match Days</div><input className="input" value={leagueDraft.primaryMatchDays} onChange={e => setLeagueDraft({ ...leagueDraft, primaryMatchDays: e.target.value })} data-testid="league-config-days" /></div>
              <div className="field"><div className="field-label">Score Deadline</div><input className="input" value={leagueDraft.scoreReportingDeadline} onChange={e => setLeagueDraft({ ...leagueDraft, scoreReportingDeadline: e.target.value })} data-testid="league-config-deadline" /></div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}><button className="btn" onClick={saveLeagueConfig} data-testid="admin-save-league-config">Save League Configuration</button><button className="btn ghost" onClick={resetLeagueConfig} data-testid="admin-reset-league-config">Reset Defaults</button></div>
          </div>



          <div className="card tenant-scope-card" data-testid="admin-tenant-scope-card">
            <h2>🏢 Active Club / Season</h2>
            <p className="hint">Current data path is scoped by club and season. To switch clubs, update Club ID and Season ID below, then save Commercial Operations.</p>
            <div className="tenant-scope-pills"><span>Club: {(tenantScope.clubId || 'koc')}</span><span>Season: {(tenantScope.seasonId || 'koc_s3')}</span></div>
          </div>

          <div className="card" data-testid="admin-commercial-ops-card">
            <h2>🧩 Commercial Operations Engine</h2>
            <p className="hint" style={{ marginBottom: '.6rem' }}>Configure scoring, club/season scope, UTR-style player profiles, and scheduling product behavior as data instead of code.</p>
            <div className="row">
              <div className="field"><div className="field-label">Club ID</div><input className="input" value={seasonDraft.clubId} onChange={e => setSeasonDraft({ ...seasonDraft, clubId: e.target.value })} data-testid="season-scope-club-id" /></div>
              <div className="field"><div className="field-label">Season ID</div><input className="input" value={seasonDraft.seasonId} onChange={e => setSeasonDraft({ ...seasonDraft, seasonId: e.target.value })} data-testid="season-scope-season-id" /></div>
            </div>
            <div className="row">
              <div className="field"><div className="field-label">Season Name</div><input className="input" value={seasonDraft.seasonName} onChange={e => setSeasonDraft({ ...seasonDraft, seasonName: e.target.value })} data-testid="season-scope-name" /></div>
              <div className="field"><div className="field-label">Ranking Metric</div><input className="input" value={profileDraft.rankingMetric} onChange={e => setProfileDraft({ ...profileDraft, rankingMetric: e.target.value })} data-testid="profile-ranking-metric" /></div>
            </div>
            <div className="league-config-grid">
              <div className="field"><div className="field-label">Win Points</div><input className="input" type="number" min="0" value={scoringDraft.winPoints} onChange={e => setScoringDraft({ ...scoringDraft, winPoints: e.target.value })} data-testid="scoring-win-points" /></div>
              <div className="field"><div className="field-label">Loss Points</div><input className="input" type="number" min="0" value={scoringDraft.lossPoints} onChange={e => setScoringDraft({ ...scoringDraft, lossPoints: e.target.value })} data-testid="scoring-loss-points" /></div>
              <div className="field"><div className="field-label">Forfeit Points</div><input className="input" type="number" min="0" value={scoringDraft.forfeitPoints} onChange={e => setScoringDraft({ ...scoringDraft, forfeitPoints: e.target.value })} data-testid="scoring-forfeit-points" /></div>
              <div className="field"><div className="field-label">Courts Available</div><input className="input" type="number" min="1" value={scheduleDraft.courtCount} onChange={e => setScheduleDraft({ ...scheduleDraft, courtCount: e.target.value })} data-testid="schedule-court-count" /></div>
              <div className="field"><div className="field-label">Slot Minutes</div><input className="input" type="number" min="15" value={scheduleDraft.slotDurationMinutes} onChange={e => setScheduleDraft({ ...scheduleDraft, slotDurationMinutes: e.target.value })} data-testid="schedule-slot-duration" /></div>
              <div className="field"><div className="field-label">Default Start</div><input className="input" value={scheduleDraft.defaultStartTime} onChange={e => setScheduleDraft({ ...scheduleDraft, defaultStartTime: e.target.value })} data-testid="schedule-default-start" /></div>
            </div>
            <div className="field"><div className="field-label">Score Line Templates</div><textarea className="textarea" value={scoringDraft.templates.map(t => `${t.label}|${t.type}|${t.setCount}|${t.tiebreakAt}|${t.tiebreakPoints}`).join('\n')} onChange={e => setScoringDraft({ ...scoringDraft, templates: e.target.value.split('\n').filter(Boolean).map((line, index) => { const [label, type, setCount, tiebreakAt, tiebreakPoints] = line.split('|'); return { id: `line-${index + 1}`, label, type, setCount, tiebreakAt, tiebreakPoints }; }) })} data-testid="scoring-templates-textarea" /></div>
            <p className="hint">Template format: Label|singles-or-doubles|set count|tiebreak at|tiebreak points. Example: Singles|singles|5|3|7</p>
            <div className="row">
              <div className="field"><div className="field-label">Schedule Format</div><select className="select" value={scheduleDraft.format} onChange={e => setScheduleDraft({ ...scheduleDraft, format: e.target.value })} data-testid="schedule-format"><option value="roundRobin">Round Robin</option><option value="ladder">Ladder / Flex</option><option value="knockout">Knockout</option><option value="poolPlay">Pool Play</option></select></div>
              <div className="field"><div className="field-label">Blackout Dates</div><input className="input" value={scheduleDraft.blackoutDates.join(', ')} onChange={e => setScheduleDraft({ ...scheduleDraft, blackoutDates: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} data-testid="schedule-blackout-dates" /></div>
            </div>
            <div className="settings-toggle-grid">
              <label><input type="checkbox" checked={scoringDraft.enforceEligibility} onChange={e => setScoringDraft({ ...scoringDraft, enforceEligibility: e.target.checked })} /> Enforce validations</label>
              <label><input type="checkbox" checked={profileDraft.requireVerifiedPlayers} onChange={e => setProfileDraft({ ...profileDraft, requireVerifiedPlayers: e.target.checked })} /> Require verified player profiles</label>
              <label><input type="checkbox" checked={profileDraft.trackAvailability} onChange={e => setProfileDraft({ ...profileDraft, trackAvailability: e.target.checked })} /> Track availability</label>
              <label><input type="checkbox" checked={scheduleDraft.autoSchedulerEnabled} onChange={e => setScheduleDraft({ ...scheduleDraft, autoSchedulerEnabled: e.target.checked })} /> Enable auto-scheduler</label>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.6rem' }}><button className="btn" onClick={saveCommercialSettings} data-testid="admin-save-commercial-settings">Save Commercial Operations</button><button className="btn ghost" onClick={resetCommercialSettings} data-testid="admin-reset-commercial-settings">Reset Operations Defaults</button></div>
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
