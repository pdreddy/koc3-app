import React, { useMemo, useState, useEffect } from 'react';
import { ref, set, update, push, onValue, remove } from 'firebase/database';
import { db, PATHS } from '../../firebase';
import {
  normalizeConfig, DEFAULT_CONFIG, RATING_TYPES, FORMAT_TYPES,
  ROSTER_ASSIGNMENT_MODES, TIEBREAK_KEYS, configToTemplate, eligibilityRulesFromConfig
} from '../../data/seasonConfig';
import { evaluateSetupHealth } from '../../utils/setupHealth';

const FORMAT_LABELS = {
  round_robin: 'Round-robin',
  knockout: 'Knockout',
  groups_playoffs: 'Groups + playoffs',
  ladder: 'Ladder',
  swiss: 'Swiss'
};

function Field({ label, children, hint }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="muted" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>{hint}</div>}
    </div>
  );
}

function SetupHealthPanel({ health }) {
  const { issues, counts, ready } = health;
  return (
    <div className="card" data-testid="setup-health-panel">
      <h2>🩺 Setup Health</h2>
      {ready ? (
        <div className="rl-flag ok" data-testid="setup-health-ready">
          <span aria-hidden="true">✅</span><span>Setup looks complete — no blocking issues. You're ready to run the season.</span>
        </div>
      ) : (
        <p className="hint" style={{ marginBottom: '.5rem' }}>
          {counts.error} blocking · {counts.warning} warning · {counts.info} info
        </p>
      )}
      <div style={{ display: 'grid', gap: '.4rem' }}>
        {issues.map((it, idx) => (
          <div
            key={`${it.section}-${idx}`}
            className={`rl-flag ${it.severity === 'error' ? 'warn' : it.severity === 'warning' ? 'warn' : 'ok'}`}
            data-testid={`setup-health-${it.severity}`}
          >
            <span aria-hidden="true">{it.severity === 'error' ? '⛔' : it.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span><strong>{it.section}:</strong> {it.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeasonSetup({ config, teams, playerRatings }) {
  const [draft, setDraft] = useState(() => normalizeConfig(config));
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [templates, setTemplates] = useState({});
  const [templateName, setTemplateName] = useState('');

  // Refresh the draft when the upstream config changes, unless the admin has
  // unsaved edits in progress.
  useEffect(() => {
    if (!dirty) setDraft(normalizeConfig(config));
  }, [config, dirty]);

  useEffect(() => {
    const unsub = onValue(ref(db, PATHS.seasonTemplates), snap => setTemplates(snap.val() || {}));
    return () => unsub();
  }, []);

  const health = useMemo(() => evaluateSetupHealth(draft, { teams, playerRatings }), [draft, teams, playerRatings]);

  const patch = (section, values) => {
    setDirty(true);
    setDraft(prev => ({ ...prev, [section]: { ...prev[section], ...values } }));
  };

  const saveAll = async () => {
    const normalized = normalizeConfig({ ...draft, updatedAt: Date.now() });
    try {
      await set(ref(db, PATHS.config), normalized);
      // Keep the legacy eligibility-rules settings in sync so ScoreEntry and the
      // captain capacity tools (existing working features) keep functioning.
      await update(ref(db, PATHS.settings), { eligibilityRules: eligibilityRulesFromConfig(normalized) });
      setDirty(false);
      setDraft(normalized);
      setMsg('✅ Season configuration saved');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg('Save failed: ' + e.message);
    }
  };

  const resetDefaults = () => {
    if (!window.confirm('Reset all season settings to the built-in defaults? Unsaved until you click Save.')) return;
    setDirty(true);
    setDraft(normalizeConfig(DEFAULT_CONFIG));
  };

  const saveAsTemplate = async () => {
    try {
      const record = configToTemplate(draft, templateName || draft.club.seasonName);
      await push(ref(db, PATHS.seasonTemplates), record);
      setTemplateName('');
      setMsg('✅ Saved as reusable template');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg('Template save failed: ' + e.message);
    }
  };

  const cloneTemplate = (tpl) => {
    if (!tpl?.config) return;
    if (!window.confirm(`Load "${tpl.name}" into the editor? Click Save to apply it as the live season.`)) return;
    setDirty(true);
    setDraft(normalizeConfig(tpl.config));
    setMsg('Loaded template into editor — review and Save to apply.');
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await remove(ref(db, `${PATHS.seasonTemplates}/${id}`));
  };

  // ---- Rating tiers --------------------------------------------------------
  const setTier = (idx, values) => {
    const tiers = draft.rating.tiers.map((t, i) => (i === idx ? { ...t, ...values } : t));
    patch('rating', { tiers });
  };
  const addTier = () => {
    const tiers = [...draft.rating.tiers, { id: `tier_${Date.now()}`, label: 'New', min: 0, max: 16.5 }];
    patch('rating', { tiers });
  };
  const removeTier = (idx) => patch('rating', { tiers: draft.rating.tiers.filter((_, i) => i !== idx) });

  // ---- Groups --------------------------------------------------------------
  const setGroup = (idx, label) => {
    const groups = draft.format.groups.map((g, i) => (i === idx ? { id: label, label } : g));
    patch('format', { groups });
  };
  const addGroup = () => {
    const next = String.fromCharCode(65 + draft.format.groups.length);
    patch('format', { groups: [...draft.format.groups, { id: next, label: next }] });
  };
  const removeGroup = (idx) => patch('format', { groups: draft.format.groups.filter((_, i) => i !== idx) });

  // ---- Line formats --------------------------------------------------------
  const setLine = (idx, values) => {
    const lineFormats = draft.format.lineFormats.map((l, i) => (i === idx ? { ...l, ...values } : l));
    patch('format', { lineFormats });
  };
  const addLine = () => {
    const n = draft.format.lineFormats.length + 1;
    patch('format', { lineFormats: [...draft.format.lineFormats, { id: `l${n}`, label: `Line ${n}`, discipline: 'singles', bestOf: 3, noAd: false, miniSets: true, finalSetTiebreak: false }] });
  };
  const removeLine = (idx) => patch('format', { lineFormats: draft.format.lineFormats.filter((_, i) => i !== idx) });

  // ---- Tiebreak order (reorderable) ---------------------------------------
  const moveTiebreak = (idx, dir) => {
    const order = [...draft.scoring.tiebreakOrder];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    patch('scoring', { tiebreakOrder: order });
  };

  const templateList = Object.entries(templates || {});

  return (
    <div data-testid="season-setup">
      {/* Sticky save bar */}
      <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <div>
          <strong>Season Setup</strong>
          <div className="muted" style={{ fontSize: '.78rem' }}>
            {dirty ? 'Unsaved changes' : 'All changes saved'} · {health.counts.error} blocking · {health.counts.warning} warnings
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
          <button className="btn small ghost" onClick={resetDefaults} data-testid="setup-reset">Reset defaults</button>
          <button className="btn small success" onClick={saveAll} disabled={!dirty} data-testid="setup-save-all">Save Configuration</button>
        </div>
      </div>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}

      <SetupHealthPanel health={health} />

      {/* 1. Club & Branding */}
      <div className="card" data-testid="setup-club">
        <h2>1 · Club &amp; Branding</h2>
        <div className="row">
          <Field label="Club Name"><input className="input" value={draft.club.name} onChange={e => patch('club', { name: e.target.value })} data-testid="setup-club-name" /></Field>
          <Field label="Tagline"><input className="input" value={draft.club.tagline} onChange={e => patch('club', { tagline: e.target.value })} /></Field>
        </div>
        <Field label="Season Name"><input className="input" value={draft.club.seasonName} onChange={e => patch('club', { seasonName: e.target.value })} /></Field>
        <div className="row">
          <Field label="Logo Emoji"><input className="input" value={draft.club.logoEmoji} onChange={e => patch('club', { logoEmoji: e.target.value })} maxLength={4} /></Field>
          <Field label="Logo URL (optional)"><input className="input" value={draft.club.logoUrl} onChange={e => patch('club', { logoUrl: e.target.value })} placeholder="https://…" /></Field>
        </div>
        <div className="row">
          <Field label="Primary Color"><input className="input" type="color" value={draft.club.primaryColor} onChange={e => patch('club', { primaryColor: e.target.value })} /></Field>
          <Field label="Accent Color"><input className="input" type="color" value={draft.club.accentColor} onChange={e => patch('club', { accentColor: e.target.value })} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.4rem' }}>
          <input type="checkbox" checked={draft.club.publicViewEnabled} onChange={e => patch('club', { publicViewEnabled: e.target.checked })} />
          <span>Public read-only view enabled (players &amp; spectators)</span>
        </label>
      </div>

      {/* 2 + 3. Teams & Squad */}
      <div className="card" data-testid="setup-teams">
        <h2>2 · Teams &amp; 3 · Squad</h2>
        <div className="row">
          <Field label="Number of Teams" hint="4–32"><input className="input" type="number" min="2" max="64" value={draft.teams.count} onChange={e => patch('teams', { count: e.target.value })} data-testid="setup-team-count" /></Field>
          <Field label="Min Squad Size"><input className="input" type="number" min="1" value={draft.teams.minSquad} onChange={e => patch('teams', { minSquad: e.target.value })} data-testid="setup-min-squad" /></Field>
          <Field label="Max Squad Size"><input className="input" type="number" min="1" value={draft.teams.maxSquad} onChange={e => patch('teams', { maxSquad: e.target.value })} data-testid="setup-max-squad" /></Field>
        </div>
        <p className="hint">Total roster needed: {draft.teams.count} × {draft.teams.minSquad} = <strong>{draft.teams.count * draft.teams.minSquad}</strong> players (validated live in Setup Health). Edit per-team names, colors, captains and rosters in the <strong>Teams</strong> tab.</p>
      </div>

      {/* 4. Rating System */}
      <div className="card" data-testid="setup-rating">
        <h2>4 · Rating System</h2>
        <div className="row">
          <Field label="Rating Type">
            <select className="select" value={draft.rating.type} onChange={e => patch('rating', { type: e.target.value })} data-testid="setup-rating-type">
              {RATING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Label"><input className="input" value={draft.rating.label} onChange={e => patch('rating', { label: e.target.value })} /></Field>
          <Field label="Min"><input className="input" type="number" step="0.1" value={draft.rating.min} onChange={e => patch('rating', { min: e.target.value })} /></Field>
          <Field label="Max"><input className="input" type="number" step="0.1" value={draft.rating.max} onChange={e => patch('rating', { max: e.target.value })} /></Field>
        </div>
        {draft.rating.type !== 'NONE' && (
          <>
            <div className="field-label" style={{ marginTop: '.6rem' }}>Tiers / Bands</div>
            {draft.rating.tiers.map((tier, idx) => (
              <div className="row-edit" key={tier.id} style={{ marginBottom: '.35rem' }} data-testid={`setup-tier-${idx}`}>
                <input className="input" value={tier.label} onChange={e => setTier(idx, { label: e.target.value })} placeholder="Label" />
                <input className="input" type="number" step="0.01" value={tier.min} onChange={e => setTier(idx, { min: e.target.value })} placeholder="Min" />
                <input className="input" type="number" step="0.01" value={tier.max} onChange={e => setTier(idx, { max: e.target.value })} placeholder="Max" />
                <button type="button" className="del" onClick={() => removeTier(idx)}>✕</button>
              </div>
            ))}
            <button type="button" className="btn small ghost" onClick={addTier} data-testid="setup-add-tier">+ Add Tier</button>
          </>
        )}
      </div>

      {/* 5. Game Format & Rules */}
      <div className="card" data-testid="setup-format">
        <h2>5 · Game Format &amp; Rules</h2>
        <div className="row">
          <Field label="Format Type">
            <select className="select" value={draft.format.type} onChange={e => patch('format', { type: e.target.value })} data-testid="setup-format-type">
              {FORMAT_TYPES.map(t => <option key={t} value={t}>{FORMAT_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="Lines / Match Day"><input className="input" type="number" min="1" value={draft.format.linesPerTie} onChange={e => patch('format', { linesPerTie: e.target.value })} data-testid="setup-lines" /></Field>
          <Field label="Singles Lines"><input className="input" type="number" min="0" value={draft.format.singlesLines} onChange={e => patch('format', { singlesLines: e.target.value })} /></Field>
          <Field label="Doubles Lines"><input className="input" type="number" min="0" value={draft.format.doublesLines} onChange={e => patch('format', { doublesLines: e.target.value })} /></Field>
        </div>

        <div className="field-label" style={{ marginTop: '.6rem' }}>Groups / Divisions</div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {draft.format.groups.map((g, idx) => (
            <span key={idx} style={{ display: 'inline-flex', gap: '.2rem', alignItems: 'center' }}>
              <input className="input" style={{ width: 70 }} value={g.label} onChange={e => setGroup(idx, e.target.value)} data-testid={`setup-group-${idx}`} />
              <button type="button" className="del" onClick={() => removeGroup(idx)}>✕</button>
            </span>
          ))}
          <button type="button" className="btn small ghost" onClick={addGroup} data-testid="setup-add-group">+ Group</button>
        </div>

        <div className="field-label" style={{ marginTop: '.6rem' }}>Per-Line Match Format</div>
        {draft.format.lineFormats.map((line, idx) => (
          <div key={line.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '.5rem', marginBottom: '.35rem' }} data-testid={`setup-line-${idx}`}>
            <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="input" style={{ flex: '1 1 90px' }} value={line.label} onChange={e => setLine(idx, { label: e.target.value })} />
              <select className="select" style={{ flex: '0 0 110px' }} value={line.discipline} onChange={e => setLine(idx, { discipline: e.target.value })}>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
              <select className="select" style={{ flex: '0 0 100px' }} value={line.bestOf} onChange={e => setLine(idx, { bestOf: Number(e.target.value) })}>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={1}>Single set</option>
              </select>
              <button type="button" className="del" onClick={() => removeLine(idx)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', marginTop: '.35rem', fontSize: '.8rem' }}>
              <label style={{ display: 'flex', gap: '.3rem' }}><input type="checkbox" checked={line.noAd} onChange={e => setLine(idx, { noAd: e.target.checked })} />No-ad</label>
              <label style={{ display: 'flex', gap: '.3rem' }}><input type="checkbox" checked={line.miniSets} onChange={e => setLine(idx, { miniSets: e.target.checked })} />Mini-sets</label>
              <label style={{ display: 'flex', gap: '.3rem' }}><input type="checkbox" checked={line.finalSetTiebreak} onChange={e => setLine(idx, { finalSetTiebreak: e.target.checked })} />Match TB final set</label>
            </div>
          </div>
        ))}
        <button type="button" className="btn small ghost" onClick={addLine} data-testid="setup-add-line">+ Add Line</button>

        <div className="field-label" style={{ marginTop: '.7rem' }}>Participation Rules</div>
        <div className="row">
          <Field label="Min Matches / Player"><input className="input" type="number" min="0" value={draft.participation.minMatches} onChange={e => patch('participation', { minMatches: e.target.value })} /></Field>
          <Field label="Max Matches / Player"><input className="input" type="number" min="1" value={draft.participation.maxMatches} onChange={e => patch('participation', { maxMatches: e.target.value })} /></Field>
          <Field label="Max Singles Days"><input className="input" type="number" min="0" value={draft.participation.maxSinglesDays} onChange={e => patch('participation', { maxSinglesDays: e.target.value })} /></Field>
          <Field label="Max Total Match Days"><input className="input" type="number" min="1" value={draft.participation.maxTotalMatchDays} onChange={e => patch('participation', { maxTotalMatchDays: e.target.value })} /></Field>
          <Field label="Max Same-Partner Days"><input className="input" type="number" min="1" value={draft.participation.maxPartnerDays} onChange={e => patch('participation', { maxPartnerDays: e.target.value })} /></Field>
        </div>
        <Field label="Injury / Replacement Policy">
          <textarea className="input" rows={2} value={draft.participation.injuryPolicy} onChange={e => patch('participation', { injuryPolicy: e.target.value })} />
        </Field>
      </div>

      {/* 6. Scoring & Standings */}
      <div className="card" data-testid="setup-scoring">
        <h2>6 · Scoring &amp; Standings</h2>
        <div className="row">
          <Field label="Points / Win"><input className="input" type="number" value={draft.scoring.pointsWin} onChange={e => patch('scoring', { pointsWin: e.target.value })} data-testid="setup-points-win" /></Field>
          <Field label="Points / Loss"><input className="input" type="number" value={draft.scoring.pointsLoss} onChange={e => patch('scoring', { pointsLoss: e.target.value })} /></Field>
          <Field label="Points / Forfeit"><input className="input" type="number" value={draft.scoring.pointsForfeit} onChange={e => patch('scoring', { pointsForfeit: e.target.value })} /></Field>
        </div>
        <div className="field-label" style={{ marginTop: '.4rem' }}>Tiebreak Hierarchy (drag order with arrows)</div>
        {draft.scoring.tiebreakOrder.map((key, idx) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.3rem 0', borderBottom: '1px solid var(--ring)' }} data-testid={`setup-tiebreak-${key}`}>
            <span style={{ fontWeight: 700, width: 22 }}>{idx + 1}.</span>
            <span style={{ flex: 1 }}>{TIEBREAK_KEYS[key]}</span>
            <button type="button" className="btn small ghost" onClick={() => moveTiebreak(idx, -1)} disabled={idx === 0}>↑</button>
            <button type="button" className="btn small ghost" onClick={() => moveTiebreak(idx, 1)} disabled={idx === draft.scoring.tiebreakOrder.length - 1}>↓</button>
          </div>
        ))}
      </div>

      {/* 7. Playoffs */}
      <div className="card" data-testid="setup-playoffs">
        <h2>7 · Playoffs</h2>
        <div className="row">
          <Field label="Qualify per Group"><input className="input" type="number" min="1" value={draft.playoffs.qualifyPerGroup} onChange={e => patch('playoffs', { qualifyPerGroup: e.target.value })} data-testid="setup-qualify" /></Field>
          <Field label="Structure">
            <select className="select" value={draft.playoffs.structure} onChange={e => patch('playoffs', { structure: e.target.value })}>
              <option value="SF_F">Semifinals → Final</option>
              <option value="QF_SF_F">Quarters → Semis → Final</option>
              <option value="F">Final only</option>
            </select>
          </Field>
          <Field label="Seeding">
            <select className="select" value={draft.playoffs.seeding} onChange={e => patch('playoffs', { seeding: e.target.value })}>
              <option value="group_cross">Cross-group (A1 v B2)</option>
              <option value="overall">Overall seeding</option>
            </select>
          </Field>
        </div>
        <div className="row">
          <Field label="Semis Window (days)"><input className="input" type="number" min="0" value={draft.playoffs.semisWindowDays} onChange={e => patch('playoffs', { semisWindowDays: e.target.value })} /></Field>
          <Field label="Finals Window (days)"><input className="input" type="number" min="0" value={draft.playoffs.finalsWindowDays} onChange={e => patch('playoffs', { finalsWindowDays: e.target.value })} /></Field>
        </div>
      </div>

      {/* 8. Roster Assignment */}
      <div className="card" data-testid="setup-roster">
        <h2>8 · Roster Assignment</h2>
        <div className="row">
          <Field label="How players join teams">
            <select className="select" value={draft.roster.assignment} onChange={e => patch('roster', { assignment: e.target.value })} data-testid="setup-assignment">
              {ROSTER_ASSIGNMENT_MODES.map(m => <option key={m} value={m}>{m === 'admin' ? 'Manual (admin assigns)' : 'Captain pick'}</option>)}
            </select>
          </Field>
          <Field label="Auction / Salary Budget"><input className="input" type="number" min="0" value={draft.roster.budget} onChange={e => patch('roster', { budget: e.target.value })} /></Field>
          <Field label="Stack-flag sensitivity" hint="0–1; higher flags sooner"><input className="input" type="number" step="0.05" min="0" max="1" value={draft.roster.stackFlagThreshold} onChange={e => patch('roster', { stackFlagThreshold: e.target.value })} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <input type="checkbox" checked={draft.roster.captainExcludedFromPool} onChange={e => patch('roster', { captainExcludedFromPool: e.target.checked })} />
          <span>Captain auto-excluded from the draftable pool</span>
        </label>
      </div>

      {/* Templates / Multi-season */}
      <div className="card" data-testid="setup-templates">
        <h2>♻️ Templates &amp; Clone Season</h2>
        <p className="hint">Save the current setup as a reusable template, then start a new season in one click by loading it.</p>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1 }} value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. 2026 Spring)" data-testid="setup-template-name" />
          <button className="btn small success" onClick={saveAsTemplate} data-testid="setup-save-template">Save as Template</button>
        </div>
        {templateList.length === 0 ? (
          <p className="muted" style={{ marginTop: '.6rem' }}>No saved templates yet.</p>
        ) : (
          <div style={{ marginTop: '.6rem', display: 'grid', gap: '.4rem' }}>
            {templateList.map(([id, tpl]) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.4rem', borderBottom: '1px solid var(--ring)', paddingBottom: '.35rem' }} data-testid={`setup-template-${id}`}>
                <div>
                  <strong>{tpl.name}</strong>
                  <div className="muted" style={{ fontSize: '.72rem' }}>{tpl.savedAt ? new Date(tpl.savedAt).toLocaleDateString() : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: '.3rem' }}>
                  <button className="btn small" onClick={() => cloneTemplate(tpl)}>Load</button>
                  <button className="btn small danger" onClick={() => deleteTemplate(id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
