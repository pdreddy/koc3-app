import React, { useMemo, useState } from 'react';
import { push, ref } from 'firebase/database';
import { db, PATHS, ensureAuth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { matchName } from '../utils/nameMatch';

const COURT_TEMPLATES = [
  { label: 'Singles 1', type: 'singles' },
  { label: 'Doubles 1', type: 'doubles' },
  { label: 'Doubles 2', type: 'doubles' }
];

function newCourt(label, type) {
  return {
    label, type,
    p1: type === 'singles' ? [''] : ['', ''],
    p2: type === 'singles' ? [''] : ['', ''],
    sets: [{ a: '', b: '', tieA: '', tieB: '' }, { a: '', b: '', tieA: '', tieB: '' }, { a: '', b: '', tieA: '', tieB: '' }]
  };
}

function PlayerInput({ value, onChange, roster, testid }) {
  const [focus, setFocus] = useState(false);
  const result = useMemo(() => matchName(value, roster), [value, roster]);
  const showSuggest = focus && value && !result.exact && result.suggestions.length > 0;
  const showNoMatch = focus && value && result.suggestions.length === 0;
  const matchedExact = result.exact;
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={value}
        placeholder="Player name"
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 180)}
        data-testid={testid}
        style={{
          borderColor: matchedExact ? '#10b981' : (showNoMatch ? '#ef4444' : undefined),
          paddingRight: '2rem'
        }}
      />
      {matchedExact && (
        <span style={{ position: 'absolute', right: 10, top: 11, color: '#10b981', fontWeight: 900 }} data-testid={`${testid}-match-ok`}>✓</span>
      )}
      {showNoMatch && (
        <span style={{ position: 'absolute', right: 10, top: 11, color: '#ef4444', fontWeight: 900 }} data-testid={`${testid}-match-bad`}>✗</span>
      )}
      {showSuggest && (
        <div className="suggest" data-testid={`${testid}-suggest`}>
          {result.suggestions.map((s, i) => (
            <div
              key={i}
              className="suggest-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(s.name); setFocus(false); }}
              data-testid={`${testid}-suggest-${i}`}
            >
              {s.isCaptain ? '🏆 ' : ''}{s.name}
              <span className="score">{Math.round(s.score * 100)}% match</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetRow({ idx, set, onChange }) {
  return (
    <div className="set-input">
      <span className="label">Set {idx + 1}</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={set.a}
        onChange={e => onChange({ ...set, a: e.target.value })}
        placeholder="0"
        data-testid={`set-${idx}-a`}
      />
      <span>-</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={set.b}
        onChange={e => onChange({ ...set, b: e.target.value })}
        placeholder="0"
        data-testid={`set-${idx}-b`}
      />
      {(Number(set.a) === Number(set.b) && set.a !== '' && set.b !== '') && (
        <>
          <span style={{ fontSize: '.75rem', color: '#92400e' }}>TB</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={set.tieA}
            onChange={e => onChange({ ...set, tieA: e.target.value })}
            placeholder="0"
            data-testid={`set-${idx}-tieA`}
          />
          <span>-</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={set.tieB}
            onChange={e => onChange({ ...set, tieB: e.target.value })}
            placeholder="0"
            data-testid={`set-${idx}-tieB`}
          />
        </>
      )}
    </div>
  );
}

function computeCourt(c) {
  let g1 = 0, g2 = 0, s1 = 0, s2 = 0;
  const sets = [];
  for (let i = 0; i < c.sets.length; i++) {
    const s = c.sets[i];
    if (s.a === '' && s.b === '') continue;
    const a = Number(s.a) || 0, b = Number(s.b) || 0;
    g1 += a; g2 += b;
    const setEntry = { set: i + 1, team1: a, team2: b };
    if (a > b) s1++;
    else if (b > a) s2++;
    else if (s.tieA !== '' || s.tieB !== '') {
      const ta = Number(s.tieA) || 0, tb = Number(s.tieB) || 0;
      setEntry.tieBreak = { team1: ta, team2: tb };
      if (ta > tb) { s1++; g1++; } else { s2++; g2++; }
    }
    sets.push(setEntry);
  }
  const winnerTeamNum = s1 > s2 ? 1 : (s2 > s1 ? 2 : null);
  return { g1, g2, s1, s2, sets, winnerTeamNum };
}

export default function ScoreEntry({ teams, matches }) {
  const { session } = useAuth();
  const teamList = Object.values(teams || {});
  const myTeam = session.role === 'team' ? teams[session.teamId] : null;
  const isAdmin = session.role === 'admin';

  const [team1Id, setTeam1Id] = useState(myTeam?.id || '');
  const [team2Id, setTeam2Id] = useState('');
  const [courts, setCourts] = useState(() => COURT_TEMPLATES.map(t => newCourt(t.label, t.type)));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const team1 = teams[team1Id];
  const team2 = teams[team2Id];

  const updateCourt = (idx, patch) => {
    setCourts(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const totals = useMemo(() => {
    let totalG1 = 0, totalG2 = 0, totalS1 = 0, totalS2 = 0, w1 = 0, w2 = 0;
    courts.forEach(c => {
      const r = computeCourt(c);
      totalG1 += r.g1; totalG2 += r.g2;
      totalS1 += r.s1; totalS2 += r.s2;
      if (r.winnerTeamNum === 1) w1++;
      else if (r.winnerTeamNum === 2) w2++;
    });
    return { totalG1, totalG2, totalS1, totalS2, w1, w2 };
  }, [courts]);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!team1 || !team2) { setError('Please choose both teams.'); return; }
    if (team1.id === team2.id) { setError('Teams must be different.'); return; }

    // For team captains, must include their own team
    if (session.role === 'team' && team1.id !== session.teamId && team2.id !== session.teamId) {
      setError('Your team must be involved in the match.');
      return;
    }

    // Validate all player names exist
    const validationErrors = [];
    const lines = courts.map((c, idx) => {
      const r = computeCourt(c);
      if (r.sets.length === 0) return null; // skip empty courts
      const checkSide = (names, team, side) => {
        return names.map((n, i) => {
          const trimmed = (n || '').trim();
          if (!trimmed) {
            validationErrors.push(`${c.label}: empty ${side} player ${i + 1}`);
            return trimmed;
          }
          const m = matchName(trimmed, team.players || []);
          if (!m.exact && !m.matched) {
            validationErrors.push(`${c.label}: "${trimmed}" not found in ${team.name}`);
            return trimmed;
          }
          return (m.matched || { name: trimmed }).name;
        });
      };
      const p1 = checkSide(c.p1, team1, `${team1.abbreviation}`);
      const p2 = checkSide(c.p2, team2, `${team2.abbreviation}`);
      if (r.winnerTeamNum === null) {
        validationErrors.push(`${c.label}: no clear winner from scores`);
      }
      return {
        label: c.label,
        type: c.type,
        g1: r.g1, g2: r.g2,
        sets: r.sets,
        setWins: { team1: r.s1, team2: r.s2 },
        players: { team1: p1, team2: p2 },
        winner: r.winnerTeamNum === 1 ? team1.name : (r.winnerTeamNum === 2 ? team2.name : null)
      };
    }).filter(Boolean);

    if (lines.length === 0) {
      setError('Please enter at least one court with scores.');
      return;
    }
    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
      return;
    }

    const winner = totals.w1 > totals.w2 ? team1.name : (totals.w2 > totals.w1 ? team2.name : null);
    if (!winner) { setError('Match is tied on courts won. Please verify scores.'); return; }

    const record = {
      t1: team1.name,
      t2: team2.name,
      t1Abbr: team1.abbreviation,
      t2Abbr: team2.abbreviation,
      g1: totals.totalG1, g2: totals.totalG2,
      s1: totals.totalS1, s2: totals.totalS2,
      courtsWon1: totals.w1, courtsWon2: totals.w2,
      win: winner,
      ts: Date.now(),
      enteredBy: session.role === 'team' ? session.teamName : 'Admin',
      lines
    };

    try {
      setSaving(true);
      await ensureAuth();
      await push(ref(db, PATHS.matches), record);
      setSuccess(`✅ Saved: ${team1.name} vs ${team2.name} — Winner: ${winner}`);
      setCourts(COURT_TEMPLATES.map(t => newCourt(t.label, t.type)));
    } catch (e) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container">
      <div className="page-title">
        <h1>Enter Score</h1>
        <p>{myTeam ? `Captain: ${myTeam.name}` : 'Admin score entry'}</p>
      </div>

      {error && <div className="error-box" data-testid="score-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
      {success && <div className="success-box" data-testid="score-success">{success}</div>}

      <div className="card">
        <h2>🆚 Teams</h2>
        <div className="row">
          <div>
            <div className="field-label">Your team</div>
            <select
              className="select"
              value={team1Id}
              onChange={e => setTeam1Id(e.target.value)}
              disabled={!isAdmin && !!myTeam}
              data-testid="team1-select"
            >
              <option value="">— Select —</option>
              {teamList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <span className="vs">vs</span>
          <div>
            <div className="field-label">Opponent</div>
            <select
              className="select"
              value={team2Id}
              onChange={e => setTeam2Id(e.target.value)}
              data-testid="team2-select"
            >
              <option value="">— Select —</option>
              {teamList.filter(t => t.id !== team1Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {team1 && team2 && courts.map((c, idx) => (
        <div className="match-line" key={idx}>
          <h3>{c.label} <span className="tag">{c.type}</span></h3>

          <div style={{ marginBottom: '.4rem' }}>
            <div className="field-label">{team1.abbreviation} player{c.type === 'doubles' ? 's' : ''}</div>
            {c.p1.map((n, i) => (
              <div style={{ marginBottom: '.4rem' }} key={i}>
                <PlayerInput
                  value={n}
                  onChange={(v) => updateCourt(idx, { p1: c.p1.map((x, j) => j === i ? v : x) })}
                  roster={team1.players || []}
                  testid={`court-${idx}-p1-${i}`}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '.4rem' }}>
            <div className="field-label">{team2.abbreviation} player{c.type === 'doubles' ? 's' : ''}</div>
            {c.p2.map((n, i) => (
              <div style={{ marginBottom: '.4rem' }} key={i}>
                <PlayerInput
                  value={n}
                  onChange={(v) => updateCourt(idx, { p2: c.p2.map((x, j) => j === i ? v : x) })}
                  roster={team2.players || []}
                  testid={`court-${idx}-p2-${i}`}
                />
              </div>
            ))}
          </div>

          <div className="field-label">Sets ({team1.abbreviation} – {team2.abbreviation})</div>
          {c.sets.map((s, i) => (
            <div key={i} data-testid={`court-${idx}-set-${i}-row`}>
              <SetRow idx={i} set={s} onChange={(ns) => updateCourt(idx, { sets: c.sets.map((x, j) => j === i ? ns : x) })} />
            </div>
          ))}
        </div>
      ))}

      {team1 && team2 && (
        <div className="card">
          <h2>📊 Summary</h2>
          <div data-testid="score-summary">
            <div><strong>{team1.abbreviation}</strong> {totals.totalG1} - {totals.totalG2} <strong>{team2.abbreviation}</strong></div>
            <div className="muted">Sets: {totals.totalS1}-{totals.totalS2} · Courts won: {totals.w1}-{totals.w2}</div>
            <div style={{ marginTop: '.5rem' }}>
              {totals.w1 > totals.w2 && <span className="tag win" data-testid="winner-tag">{team1.name} leading</span>}
              {totals.w2 > totals.w1 && <span className="tag win" data-testid="winner-tag">{team2.name} leading</span>}
              {totals.w1 === totals.w2 && (totals.w1 + totals.w2) > 0 && <span className="tag tie" data-testid="winner-tag">Tied</span>}
            </div>
          </div>
          <button
            className="btn success full"
            style={{ marginTop: '.8rem' }}
            onClick={handleSubmit}
            disabled={saving}
            data-testid="submit-score-btn"
          >
            {saving ? 'Saving...' : 'Save Match Result'}
          </button>
        </div>
      )}
    </main>
  );
}
