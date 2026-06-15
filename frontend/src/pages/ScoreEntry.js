import React, { useMemo, useState } from 'react';
import { push, ref } from 'firebase/database';
import { db, PATHS, ensureAuth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { matchName } from '../utils/nameMatch';
import { parseQuickScore } from '../utils/quickScoreParser';

const COURT_TEMPLATES = [
  { label: 'Singles', type: 'singles', setCount: 5 },
  { label: 'Doubles 1', type: 'doubles', setCount: 3 },
  { label: 'Doubles 1 Reverse', type: 'doubles', setCount: 3 },
  { label: 'Doubles 2', type: 'doubles', setCount: 3 },
  { label: 'Doubles 2 Reverse', type: 'doubles', setCount: 3 }
];


function getQuickTemplate(teams) {
  const list = Object.values(teams || {});
  const t1 = list.find(t => t.abbreviation === 'KC') || list[0];
  const t2 = list.find(t => t.abbreviation === 'ML') || list.find(t => t.id !== t1?.id) || list[1];
  const p1 = t1?.players || [];
  const p2 = t2?.players || [];
  const name = (players, idx, fallback) => players[idx]?.name || fallback;
  const a = t1?.abbreviation || 'TEAM1';
  const b = t2?.abbreviation || 'TEAM2';
  return `${a} vs ${b}

S1: ${name(p1, 0, 'Singles A1')} vs ${name(p2, 0, 'Singles B1')}
4-3, 4-2, 0-4, 4-2 (won) ${a}

D1: ${name(p1, 1, 'A Pair 1')}/${name(p1, 2, 'A Pair 2')} vs ${name(p2, 1, 'B Pair 1')}/${name(p2, 2, 'B Pair 2')}
4-3, 1-4, 1-0 (won) ${a}

D1: ${name(p1, 1, 'A Pair 1')}/${name(p1, 2, 'A Pair 2')} vs ${name(p2, 3, 'B Pair 3')}/${name(p2, 4, 'B Pair 4')}
3-4, 1-4 (won) ${b}

D2: ${name(p1, 3, 'A Pair 3')}/${name(p1, 4, 'A Pair 4')} vs ${name(p2, 3, 'B Pair 3')}/${name(p2, 4, 'B Pair 4')}
0-4, 2-4 (won) ${b}

D2: ${name(p1, 3, 'A Pair 3')}/${name(p1, 4, 'A Pair 4')} vs ${name(p2, 1, 'B Pair 1')}/${name(p2, 2, 'B Pair 2')}
4-1, 4-2 (won) ${a}

Final: ${a} won 3-2`;
}

function normalizeQuickText(text, teams) {
  const abbrs = new Set(Object.values(teams || {}).map(t => t.abbreviation?.toUpperCase()).filter(Boolean));
  const lines = (text || '').split('\n').map(line => {
    let out = line.trim().replace(/\s+/g, ' ');
    out = out.replace(/\bvs\.?\b/ig, 'vs');
    out = out.replace(/\(\s*won\s*\)/ig, '(won)');
    out = out.replace(/^(singles?)\s*[:.-]?\s*/i, 'S1: ');
    out = out.replace(/^doubles\s*(\d)?\s*[:.-]?\s*/i, (_, n) => `D${n || ''}: `);
    out = out.replace(/^d(\d)\s+/i, 'D$1: ');
    out = out.replace(/^s(\d)\s+/i, 'S$1: ');
    out = out.replace(/^s\s+/i, 'S1: ');
    out = out.replace(/^S:\s*(S\d\s*:)/i, '$1');
    out = out.replace(/\b([a-z]{2,4}|t\d{2})\b/g, token => {
      const upper = token.toUpperCase();
      return abbrs.has(upper) ? upper : token;
    });
    if (out && /^.+\svs\s.+/i.test(out) && !/^(S\d?|D\d?)\s*:/i.test(out) && !/^\w+\s+vs\s+\w+$/i.test(out)) {
      out = `S1: ${out}`;
    }
    return out;
  });
  return lines.join('\n');
}

function getQuickGuidance(text, parsed, teams) {
  const raw = (text || '').trim();
  const teamAbbrs = Object.values(teams || {}).map(t => t.abbreviation).filter(Boolean);
  if (!raw) {
    return [
      'Start with TEAM1 vs TEAM2 using team abbreviations.',
      'Singles use S1 and can be best-of-5 sets.',
      'Doubles use D1/D1 reverse and D2/D2 reverse; pair 1 and pair 2 play both opponent pairs.'
    ];
  }
  const tips = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines[0] && !/^\w+\s+vs\.?\s+\w+$/i.test(lines[0])) tips.push(`First line format: ${teamAbbrs[0] || 'SK'} vs ${teamAbbrs[1] || 'RR'}`);
  lines.slice(1).forEach((line, idx) => {
    const lineNo = idx + 2;
    const nextLine = lines[idx + 2] || '';
    const hasScoreContinuation = /^[\d\s,()-]+\(won\)/i.test(nextLine);
    if (/^final\s*:/i.test(line) || /^[\d\s,()-]+\(won\)/i.test(line)) return;
    if (!/^(S\d?|D\d?|Singles\s*\d?|Doubles\s*\d?)\s*:/i.test(line)) tips.push(`Line ${lineNo}: add court label like S1:, D1:, or D2:.`);
    if (!/\s+vs\.?\s+/i.test(line)) tips.push(`Line ${lineNo}: include "vs" between players.`);
    if (!hasScoreContinuation && !/\d+-\d+/.test(line)) tips.push(`Line ${lineNo}: add set scores like 4-2,4-1.`);
    if (!hasScoreContinuation && !/\(won\)\s*\w+/i.test(line)) tips.push(`Line ${lineNo}: end with (won) ${parsed.team1?.abbreviation || teamAbbrs[0] || 'TEAM'}.`);
  });
  if (parsed.corrections?.length) parsed.corrections.forEach(c => tips.push(c));
  if (parsed.errors?.length && tips.length === 0) tips.push('Follow the sample format below, then use Auto-format to clean spacing and labels.');
  return Array.from(new Set(tips)).slice(0, 6);
}

function newCourt(label, type, setCount = 3) {
  return {
    label, type,
    p1: type === 'singles' ? [''] : ['', ''],
    p2: type === 'singles' ? [''] : ['', ''],
    sets: Array.from({ length: setCount }, () => ({ a: '', b: '', tieA: '', tieB: '' }))
  };
}

function PlayerInput({ value, onChange, roster, teamAbbr, testid }) {
  const [focus, setFocus] = useState(false);
  const trimmedValue = value.trim();
  const canSuggest = trimmedValue.length >= 3;
  const result = useMemo(() => matchName(value, roster), [value, roster]);
  const rosterSuggestions = useMemo(() => {
    if (!canSuggest || result.exact) return [];
    const query = trimmedValue.toLowerCase();
    const ranked = (roster || [])
      .map((player) => {
        const name = player.name || '';
        const lowerName = name.toLowerCase();
        const firstToken = lowerName.split(/\s+/)[0] || '';
        let rank = 3;
        if (firstToken.startsWith(query)) rank = 0;
        else if (lowerName.startsWith(query)) rank = 1;
        else if (lowerName.includes(query)) rank = 2;
        return { ...player, rank };
      })
      .filter(player => player.rank < 3)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .slice(0, 5);

    const seen = new Set(ranked.map(player => player.name));
    const fuzzy = (result.suggestions || []).filter(player => !seen.has(player.name));
    return [...ranked, ...fuzzy].slice(0, 5);
  }, [canSuggest, result.exact, result.suggestions, roster, trimmedValue]);
  const showSuggest = focus && canSuggest && !result.exact && rosterSuggestions.length > 0;
  const showNoMatch = focus && canSuggest && !result.exact && rosterSuggestions.length === 0;
  const matchedExact = result.exact;
  const applySuggestion = (name) => {
    onChange(name);
    setFocus(false);
  };
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={value}
        placeholder={teamAbbr ? `Type 3 letters for ${teamAbbr} roster` : 'Type 3 letters for roster'}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onKeyDown={(e) => {
          if ((e.key === 'Tab' || e.key === 'Enter') && showSuggest && rosterSuggestions[0]) {
            e.preventDefault();
            applySuggestion(rosterSuggestions[0].name);
          }
        }}
        onBlur={() => setTimeout(() => setFocus(false), 180)}
        autoComplete="off"
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
          <div className="suggest-hint">Choose a {teamAbbr || 'team'} player, or press Enter/Tab for the first match</div>
          {rosterSuggestions.map((s, i) => (
            <div
              key={s.name || i}
              className="suggest-item"
              onMouseDown={(e) => { e.preventDefault(); applySuggestion(s.name); }}
              data-testid={`${testid}-suggest-${i}`}
            >
              {s.isCaptain ? '🏆 ' : ''}{s.name}
              {typeof s.score === 'number' && <span className="score">{Math.round(s.score * 100)}% match</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetRow({ idx, set, onChange, disabled }) {
  return (
    <div className="set-input">
      <span className="label">Set {idx + 1}</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={set.a}
        min="0"
        max="7"
        disabled={disabled}
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
        min="0"
        max="7"
        disabled={disabled}
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
            min="0"
            disabled={disabled}
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
            min="0"
            disabled={disabled}
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


function courtHasEntry(c) {
  return [...c.p1, ...c.p2].some(n => (n || '').trim()) || c.sets.some(s => s.a !== '' || s.b !== '' || s.tieA !== '' || s.tieB !== '');
}

function getDuplicatePlayers(courts) {
  const seen = new Map();
  const duplicates = new Set();
  courts.forEach(c => {
    [...c.p1, ...c.p2].forEach(name => {
      const key = (name || '').trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) duplicates.add((name || '').trim());
      seen.set(key, true);
    });
  });
  return Array.from(duplicates);
}

function courtCompletion(c) {
  if (!courtHasEntry(c)) return { status: 'empty', message: 'Not started' };
  const r = computeCourt(c);
  if (r.sets.length === 0) return { status: 'warning', message: 'Add set scores' };
  if (r.winnerTeamNum === null) return { status: 'warning', message: 'Needs clear winner' };
  return { status: 'ready', message: `Ready · ${r.s1}-${r.s2} sets · ${r.g1}-${r.g2} games` };
}

export default function ScoreEntry({ teams, matches }) {
  const [mode, setMode] = useState('form');
  return (
    <main className="container">
      <div className="page-title">
        <h1>Enter Score</h1>
        <p>Quick paste or fill the form — both validate names against rosters</p>
      </div>
      <div className="tabs">
        <button
          className={`tab ${mode === 'form' ? 'active' : ''}`}
          onClick={() => setMode('form')}
          data-testid="score-tab-form"
        >📝 Form</button>
        <button
          className={`tab ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
          data-testid="score-tab-paste"
        >⚡ Quick Paste</button>
      </div>
      {mode === 'form' ? <FormEntry teams={teams} matches={matches} /> : <QuickEntry teams={teams} />}
    </main>
  );
}

function FormEntry({ teams, matches }) {
  const { session } = useAuth();
  const teamList = Object.values(teams || {});
  const myTeam = session.role === 'team' ? teams[session.teamId] : null;
  const isAdmin = session.role === 'admin';

  const [team1Id, setTeam1Id] = useState(myTeam?.id || '');
  const [team2Id, setTeam2Id] = useState('');
  const [courts, setCourts] = useState(() => COURT_TEMPLATES.map(t => newCourt(t.label, t.type, t.setCount)));
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
    const duplicatePlayers = getDuplicatePlayers(courts);
    duplicatePlayers.forEach(n => validationErrors.push(`Player entered more than once: ${n}`));

    const lines = courts.map((c, idx) => {
      const r = computeCourt(c);
      if (!courtHasEntry(c)) return null; // skip untouched courts
      if (r.sets.length === 0) {
        validationErrors.push(`${c.label}: add at least one set score or clear the court`);
        return null;
      }
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
      t1Id: team1.id,
      t2Id: team2.id,
      winnerId: totals.w1 > totals.w2 ? team1.id : team2.id,
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
      setCourts(COURT_TEMPLATES.map(t => newCourt(t.label, t.type, t.setCount)));
    } catch (e) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {myTeam && <p className="hint" style={{ marginBottom: '.7rem' }}>Captain: {myTeam.name}</p>}

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

      {team1 && team2 && courts.map((c, idx) => {
        const status = courtCompletion(c);
        return (
        <div className={`match-line court-card ${status.status}`} key={idx}>
          <h3>{c.label} <span className="tag">{c.type}</span> <span className={`tag status ${status.status}`}>{status.message}</span></h3>

          <div style={{ marginBottom: '.4rem' }}>
            <div className="field-label">{team1.abbreviation} player{c.type === 'doubles' ? 's' : ''}</div>
            {c.p1.map((n, i) => (
              <div style={{ marginBottom: '.4rem' }} key={i}>
                <PlayerInput
                  value={n}
                  onChange={(v) => updateCourt(idx, { p1: c.p1.map((x, j) => j === i ? v : x) })}
                  roster={team1.players || []}
                  teamAbbr={team1.abbreviation}
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
                  teamAbbr={team2.abbreviation}
                  testid={`court-${idx}-p2-${i}`}
                />
              </div>
            ))}
          </div>

          <div className="field-label">Sets ({team1.abbreviation} – {team2.abbreviation})</div>
          {c.sets.map((s, i) => (
            <div key={i} data-testid={`court-${idx}-set-${i}-row`}>
              <SetRow idx={i} set={s} disabled={i > 0 && c.sets[i - 1].a === '' && c.sets[i - 1].b === ''} onChange={(ns) => updateCourt(idx, { sets: c.sets.map((x, j) => j === i ? ns : x) })} />
            </div>
          ))}
        </div>
        );
      })}

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
    </>
  );
}

// ==================== QUICK PASTE ENTRY ====================

function QuickEntry({ teams }) {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseQuickScore(text, teams), [text, teams]);
  const quickTemplate = useMemo(() => getQuickTemplate(teams), [teams]);
  const guidance = useMemo(() => getQuickGuidance(text, parsed, teams), [text, parsed, teams]);
  const normalizedText = useMemo(() => normalizeQuickText(text, teams), [text, teams]);
  const canNormalize = text.trim() && normalizedText !== text;
  const applyTemplate = () => { setText(quickTemplate); setError(''); setSuccess(''); };
  const applyNormalize = () => { setText(normalizedText); setError(''); setSuccess(''); };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    const { results, errors, team1, team2 } = parsed;
    if (!team1 || !team2) { setError(errors.join('\n') || 'Could not detect teams.'); return; }
    if (errors.length > 0) { setError(errors.join('\n')); return; }
    if (results.length === 0) { setError('No valid courts parsed.'); return; }

    // Team-captain restriction
    if (session.role === 'team' && team1.id !== session.teamId && team2.id !== session.teamId) {
      setError('Your team must be involved in the match.');
      return;
    }

    let totalG1 = 0, totalG2 = 0, totalS1 = 0, totalS2 = 0, w1 = 0, w2 = 0;
    const lines = results.map(r => {
      totalG1 += r.g1; totalG2 += r.g2;
      totalS1 += r.sets1; totalS2 += r.sets2;
      if (r.winnerTeamNum === 1) w1++;
      else if (r.winnerTeamNum === 2) w2++;
      return {
        label: r.label,
        type: r.type,
        g1: r.g1, g2: r.g2,
        sets: r.sets,
        setWins: { team1: r.sets1, team2: r.sets2 },
        players: r.players,
        winner: r.winnerTeamNum === 1 ? team1.name : (r.winnerTeamNum === 2 ? team2.name : null)
      };
    });

    const winner = w1 > w2 ? team1.name : (w2 > w1 ? team2.name : null);
    if (!winner) { setError('Match is tied on courts won. Please verify scores.'); return; }

    const record = {
      t1Id: team1.id, t2Id: team2.id,
      winnerId: w1 > w2 ? team1.id : team2.id,
      t1: team1.name, t2: team2.name,
      t1Abbr: team1.abbreviation, t2Abbr: team2.abbreviation,
      g1: totalG1, g2: totalG2,
      s1: totalS1, s2: totalS2,
      courtsWon1: w1, courtsWon2: w2,
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
      setText('');
    } catch (e) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const { results, errors, team1, team2 } = parsed;

  const placeholder = `Paste match results here...

KOC3 format:
KC vs ML
S1: Srini vs Bharath
4-3, 4-2, 0-4, 4-2 (won) KC
D1: Dinkar / Satya vs Rajasekar Karru / Mohan
4-3, 1-4, 1-0 (won) KC
D1: Dinkar / Satya vs Anil / Raja
3-4, 1-4 (won) ML
D2: Srikanth / Lloyd vs Anil / Raja
0-4, 2-4 (won) ML
D2: Srikanth / Lloyd vs Rajasekar Karru / Mohan
4-1, 4-2 (won) KC
Final: KC won 3-2`;

  let totG1 = 0, totG2 = 0, tw1 = 0, tw2 = 0;
  results.forEach(r => {
    totG1 += r.g1; totG2 += r.g2;
    if (r.winnerTeamNum === 1) tw1++;
    else if (r.winnerTeamNum === 2) tw2++;
  });

  return (
    <>
      {error && <div className="error-box" data-testid="quick-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
      {success && <div className="success-box" data-testid="quick-success">{success}</div>}

      <div className="card quick-entry-card">
        <div className="quick-entry-head">
          <div>
            <h2>⚡ Quick Score Entry</h2>
            <p className="hint">Paste messy scores, then use Auto-format and the live coach to fix the format.</p>
          </div>
          <div className="quick-actions">
            <button className="btn ghost small" onClick={applyTemplate} type="button" data-testid="quick-template-btn">Use example</button>
            <button className="btn small" onClick={applyNormalize} disabled={!canNormalize} type="button" data-testid="quick-normalize-btn">Auto-format</button>
          </div>
        </div>
        <div className="quick-layout">
          <div>
            <textarea
              className="textarea quick-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={placeholder}
              data-testid="quick-textarea"
            />
            <p className="hint">
              Team abbrs: {Object.values(teams || {}).map(t => t.abbreviation).join(', ')}
            </p>
          </div>
          <aside className="format-coach" data-testid="quick-format-coach">
            <h3>Format coach</h3>
            <code>{'{TEAM1} vs {TEAM2}'}</code>
            <code>S1: Player vs Player 4-2,4-1,4-0 (won) TEAM1</code>
            <code>D1: P1/P2 vs P3/P4 4-3,1-4,1-0 (won) TEAM2</code>
            <div className="divider" />
            {guidance.map((tip, i) => <p key={i} className="coach-tip">💡 {tip}</p>)}
          </aside>
        </div>
      </div>

      {text.trim() && (
        <div className="card" data-testid="quick-preview">
          <h2>📋 Preview</h2>
          {errors.length > 0 && (
            <div className="error-box" style={{ whiteSpace: 'pre-line' }}>
              {errors.map(e => `❌ ${e}`).join('\n')}
            </div>
          )}
          {parsed.corrections?.length > 0 && (
            <div className="success-box" style={{ whiteSpace: 'pre-line' }} data-testid="quick-corrections">
              {parsed.corrections.map(c => `✨ ${c}`).join('\n')}
            </div>
          )}
          {team1 && team2 && results.length > 0 && (
            <>
              <div className="match-line" style={{ background: '#d1fae5', borderLeft: '4px solid #10b981' }}>
                <strong>📊 {team1.name} {totG1}–{totG2} {team2.name}</strong>
                <div className="muted">Courts won: {tw1}-{tw2} → {tw1 > tw2 ? team1.name : (tw2 > tw1 ? team2.name : 'TIE')}</div>
              </div>
              {results.map((r, i) => {
                const winnerAbbr = r.winnerTeamNum === 1 ? team1.abbreviation : team2.abbreviation;
                const setsDisplay = r.sets.map(s => {
                  let str = `${s.team1}-${s.team2}`;
                  if (s.tieBreak) str += `(${s.tieBreak.team1}-${s.tieBreak.team2})`;
                  return str;
                }).join(', ');
                return (
                  <div className="match-line" key={i}>
                    ✅ <strong>{r.label}:</strong> {r.players.team1.join('/')} vs {r.players.team2.join('/')}
                    <div className="muted" style={{ marginTop: '.25rem' }}>
                      {setsDisplay} (games {r.g1}-{r.g2}, won {winnerAbbr})
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {text.trim() && team1 && team2 && results.length > 0 && errors.length === 0 && (
        <button
          className="btn success full"
          onClick={handleSubmit}
          disabled={saving}
          data-testid="quick-submit-btn"
        >
          {saving ? 'Saving...' : 'Save Match Result'}
        </button>
      )}

      <button
        className="btn ghost full"
        style={{ marginTop: '.5rem' }}
        onClick={() => { setText(''); setError(''); setSuccess(''); }}
        data-testid="quick-clear-btn"
      >Clear Input</button>
    </>
  );
}
