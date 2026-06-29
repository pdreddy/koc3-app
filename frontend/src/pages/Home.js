import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db, ensureAuth, PATHS } from '../firebase';
import { writeAuditLog } from '../services/AuditService';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole } from '../utils/roles';
import { DEFAULT_ELIGIBILITY_RULES, normalizeEligibilityRules } from '../utils/eligibilityRules';
import { approvedMatches } from '../utils/matchStatus';
import { resolveMatchTeams } from '../utils/matchTeams';
import { CaptainCapacityCard, buildCaptainCapacityRows } from '../components/CaptainCapacity';

function formatDate(iso) {
  if (!iso) return 'TBD';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fixtureTeams(item, teams) {
  return { team1: teams?.[item.team1Id], team2: teams?.[item.team2Id] };
}

function pairKey(a, b) {
  return [a, b].filter(Boolean).sort().join('|');
}


const LINEUP_ROLE_SLOTS = [
  { code: 'S1', label: 'Singles' },
  { code: 'D1', label: 'Doubles 1 player A' },
  { code: 'D1', label: 'Doubles 1 player B' },
  { code: 'D2', label: 'Doubles 2 player A' },
  { code: 'D2', label: 'Doubles 2 player B' }
];

const LINEUP_STATUS = {
  notSubmitted: { label: '🟢 Not Submitted', className: 'lineup-status not-submitted' },
  submitted: { label: '🟡 Submitted & Locked', className: 'lineup-status submitted' },
  waiting: { label: '🔵 Waiting for Opponent', className: 'lineup-status waiting' },
  yourTurn: { label: '🟠 Waiting for Your Lineup', className: 'lineup-status your-turn' },
  revealed: { label: '🟣 Revealed', className: 'lineup-status revealed' },
  completed: { label: '⚫ Completed', className: 'lineup-status completed' }
};

function timeLabel(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function selectedNames(team, selected = []) {
  return LINEUP_ROLE_SLOTS.map((_, idx) => team?.players?.[Number(selected[idx])]?.name || '');
}

function buildDashboardLineupLines(names) {
  return [
    { label: 'S1', players: [names[0]].filter(Boolean) },
    { label: 'D1', players: [names[1], names[2]].filter(Boolean) },
    { label: 'D2', players: [names[3], names[4]].filter(Boolean) }
  ];
}

function eligibilityPlayerKey(teamId, playerName) {
  return `${teamId || ''}:${String(playerName || '').trim().toLowerCase()}`;
}

function eligibilityPairKey(teamId, names) {
  return `${teamId || ''}:${[...(names || [])].map(name => String(name || '').trim().toLowerCase()).sort().join('|')}`;
}

function buildExistingEligibility(matches, teams) {
  const playerDays = new Map();
  const partnerDays = new Map();
  (matches || []).forEach(match => {
    if (match.status && match.status !== 'APPROVED' && match.status !== 'approved') return;
    const team1 = teams?.[match.t1Id] || Object.values(teams || {}).find(team => team.name === match.t1);
    const team2 = teams?.[match.t2Id] || Object.values(teams || {}).find(team => team.name === match.t2);
    if (!team1 || !team2) return;
    const matchPlayers = new Map();
    const matchPairs = new Set();
    (match.lines || []).forEach(line => {
      const type = line.type === 'singles' ? 'singles' : 'doubles';
      [[team1, line.players?.team1 || []], [team2, line.players?.team2 || []]].forEach(([lineTeam, names]) => {
        names.forEach(name => {
          const key = eligibilityPlayerKey(lineTeam.id, name);
          const row = matchPlayers.get(key) || { teamId: lineTeam.id, name, singles: false, doubles: false };
          if (type === 'singles') row.singles = true;
          if (type === 'doubles') row.doubles = true;
          matchPlayers.set(key, row);
        });
        if (type === 'doubles' && names.length === 2) matchPairs.add(eligibilityPairKey(lineTeam.id, names));
      });
    });
    matchPlayers.forEach(row => {
      const key = eligibilityPlayerKey(row.teamId, row.name);
      const previous = playerDays.get(key) || { totalMatchDays: 0, singlesDays: 0, doublesDays: 0 };
      playerDays.set(key, {
        totalMatchDays: previous.totalMatchDays + 1,
        singlesDays: previous.singlesDays + (row.singles ? 1 : 0),
        doublesDays: previous.doublesDays + (row.doubles ? 1 : 0)
      });
    });
    matchPairs.forEach(pairKey => partnerDays.set(pairKey, (partnerDays.get(pairKey) || 0) + 1));
  });
  return { playerDays, partnerDays };
}

function captainLineupEligibilityErrors(team, names, matches, teams, eligibilityRules = DEFAULT_ELIGIBILITY_RULES) {
  const rules = normalizeEligibilityRules(eligibilityRules);
  const existing = buildExistingEligibility(matches, teams);
  const lines = [
    { type: 'singles', players: [names[0]].filter(Boolean) },
    { type: 'doubles', players: [names[1], names[2]].filter(Boolean) },
    { type: 'doubles', players: [names[1], names[2]].filter(Boolean) },
    { type: 'doubles', players: [names[3], names[4]].filter(Boolean) },
    { type: 'doubles', players: [names[3], names[4]].filter(Boolean) }
  ].filter(line => line.players.length > 0);
  const currentPlayers = new Map();
  const currentPairs = new Map();
  lines.forEach(line => {
    line.players.forEach(name => {
      const key = eligibilityPlayerKey(team.id, name);
      const row = currentPlayers.get(key) || { name, teamId: team.id, singles: false, doublesCount: 0 };
      if (line.type === 'singles') row.singles = true;
      if (line.type === 'doubles') row.doublesCount += 1;
      currentPlayers.set(key, row);
    });
    if (line.type === 'doubles' && line.players.length === 2) {
      const pairKey = eligibilityPairKey(team.id, line.players);
      const pair = currentPairs.get(pairKey) || { names: line.players, days: 0 };
      pair.days = 1;
      currentPairs.set(pairKey, pair);
    }
  });
  const errors = [];
  currentPlayers.forEach(row => {
    if (row.singles && row.doublesCount > 0) errors.push(`${row.name}: cannot play singles and doubles on the same match day`);
    if (row.doublesCount > 0 && row.doublesCount !== 2) errors.push(`${row.name}: doubles players must play both Doubles and Reverse Doubles`);
    const previous = existing.playerDays.get(eligibilityPlayerKey(row.teamId, row.name)) || { singlesDays: 0, doublesDays: 0 };
    const nextSingles = previous.singlesDays + (row.singles ? 1 : 0);
    const nextDoubles = previous.doublesDays + (row.doublesCount > 0 ? 1 : 0);
    const nextTotal = nextSingles + nextDoubles;
    if (nextSingles > rules.maxSinglesDays) errors.push(`${row.name}: singles limit exceeded (${nextSingles}/${rules.maxSinglesDays} Singles Days)`);
    if (nextTotal > rules.maxTotalMatchDays) errors.push(`${row.name}: match-day limit exceeded (${nextTotal}/${rules.maxTotalMatchDays} Match Days)`);
  });
  currentPairs.forEach((pair, pairKey) => {
    const nextPartnerDays = (existing.partnerDays.get(pairKey) || 0) + pair.days;
    if (nextPartnerDays > rules.maxPartnerDays) errors.push(`${pair.names.join(' + ')}: doubles partner limit exceeded (${nextPartnerDays}/${rules.maxPartnerDays} Match Days)`);
  });
  return errors;
}

function validateDashboardLineup(team, selected, matches, teams, eligibilityRules = DEFAULT_ELIGIBILITY_RULES) {
  const errors = [];
  const normalized = LINEUP_ROLE_SLOTS.map((_, idx) => selected[idx] || '');
  if (normalized.some(value => !value)) errors.push('Select all 5 lineup slots before locking.');
  const picked = normalized.filter(Boolean);
  if (new Set(picked).size !== picked.length) errors.push('A player can only appear in one lineup role.');
  picked.forEach(value => {
    if (!team?.players?.[Number(value)]?.name) errors.push('Every selected player must exist on your roster.');
  });
  errors.push(...captainLineupEligibilityErrors(team, selectedNames(team, normalized), matches, teams, eligibilityRules));
  return Array.from(new Set(errors));
}

function lineupByLabel(submission) {
  return Object.fromEntries((submission?.lineup || []).map(line => [line.label, line.players || []]));
}

function revealedLineupRows(mySubmission, opponentSubmission) {
  const mine = lineupByLabel(mySubmission);
  const theirs = lineupByLabel(opponentSubmission);
  return ['S1', 'D1', 'D2'].map(label => ({
    label,
    mine: mine[label] || [],
    theirs: theirs[label] || []
  }));
}

function revealedRecordRows(revealedLineup, myTeamId, opponentTeamId, mySubmission, opponentSubmission) {
  if (!revealedLineup?.lineups) return revealedLineupRows(mySubmission, opponentSubmission);
  const mine = lineupByLabel({ lineup: revealedLineup.lineups?.[myTeamId] || [] });
  const theirs = lineupByLabel({ lineup: revealedLineup.lineups?.[opponentTeamId] || [] });
  return ['S1', 'D1', 'D2'].map(label => ({
    label,
    mine: mine[label] || [],
    theirs: theirs[label] || []
  }));
}

function whatsappMessage(team, opponent, captainName, mySubmission, opponentSubmission, revealedLineup) {
  const rows = revealedRecordRows(revealedLineup, team?.id, opponent?.id, mySubmission, opponentSubmission)
    .map(row => `${row.label}: ${row.mine.join(' / ')} vs ${row.theirs.join(' / ')}`)
    .join('\n');
  return `KOC Match\n\n${team?.name || 'Our Team'} vs ${opponent?.name || 'Opponent'}\n\nCaptain:\n${captainName || 'Captain'}\n\nOfficial revealed lineups:\n${rows}\n\nThe KOC App remains the official source of truth.`;
}

function statusForFixture(isCompleted, mine, theirs) {
  if (isCompleted) return LINEUP_STATUS.completed;
  if (mine?.revealedAt || (mine?.lockedAt && theirs?.lockedAt)) return LINEUP_STATUS.revealed;
  if (mine?.lockedAt && !mine?.unlockedAt) return LINEUP_STATUS.submitted;
  if (theirs?.lockedAt && !mine?.lockedAt) return LINEUP_STATUS.yourTurn;
  if (theirs?.lockedAt) return LINEUP_STATUS.waiting;
  return LINEUP_STATUS.notSubmitted;
}

function LineupRoleSelect({ team, selected, onChange, readOnly, optionErrors = {} }) {
  const selectedSet = new Set(selected.filter(Boolean));
  const renderSlot = (slotIdx) => {
    const slot = LINEUP_ROLE_SLOTS[slotIdx];
    return (
      <label className="field" key={`${slot.code}-${slotIdx}`}>
        <div className="field-label">{slot.code} · {slot.label}</div>
        <select className="select" value={selected[slotIdx] || ''} onChange={e => onChange(slotIdx, e.target.value)} disabled={readOnly} data-testid={`dashboard-lineup-slot-${slotIdx}`}>
          <option value="">— Choose player —</option>
          {(team?.players || []).map((player, playerIdx) => {
            const value = String(playerIdx);
            return <option key={`${player.name}-${playerIdx}`} value={value} disabled={selectedSet.has(value) && selected[slotIdx] !== value}>{optionErrors[`${slotIdx}:${value}`] ? `⚠️ ${player.name}` : player.name}</option>;
          })}
        </select>
      </label>
    );
  };
  return (
    <div className="dashboard-lineup-roles">
      <div className="dashboard-lineup-row dashboard-lineup-singles">
        <h4>Singles</h4>
        {renderSlot(0)}
      </div>
      <div className="dashboard-lineup-row">
        <h4>Doubles 1</h4>
        <div className="dashboard-lineup-pair">{renderSlot(1)}{renderSlot(2)}</div>
      </div>
      <div className="dashboard-lineup-row">
        <h4>Doubles 2</h4>
        <div className="dashboard-lineup-pair">{renderSlot(3)}{renderSlot(4)}</div>
      </div>
    </div>
  );
}


function OpponentCapacityPreview({ opponent, teams, matches, eligibilityRules, lineupSubmissions }) {
  const rows = useMemo(() => opponent ? buildCaptainCapacityRows(opponent, teams, matches, eligibilityRules, lineupSubmissions) : [], [opponent, teams, matches, eligibilityRules, lineupSubmissions]);
  if (!opponent) return null;
  const highlighted = [...rows]
    .sort((a, b) => (b.warnings.length - a.warnings.length) || (b.totalMatchDays - a.totalMatchDays) || a.name.localeCompare(b.name))
    .slice(0, 6);
  return (
    <div className="opponent-capacity-panel" data-testid={`opponent-capacity-${opponent.id}`}>
      <div>
        <h4>{opponent.name} capacity</h4>
        <p className="hint">Preview is hidden by default and shown only for this scheduled match.</p>
      </div>
      <div className="opponent-capacity-grid">
        {highlighted.map(row => (
          <div key={row.name} className={row.warnings.length ? 'opponent-capacity-row warn' : 'opponent-capacity-row'}>
            <strong>{row.name}</strong>
            <span>S {row.singlesDays} · Total {row.totalMatchDays} · Partner {row.maxPartner}</span>
            <small>{row.warnings.length ? row.warnings.join(', ') : 'Available'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptainFixtureCard({ item, teams, captainTeam, completed, lineupSubmission, opponentSubmission, revealedLineup, matches, eligibilityRules, session, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [showOpponentCapacity, setShowOpponentCapacity] = useState(false);
  const { team1, team2 } = fixtureTeams(item, teams);
  const opponent = item.team1Id === captainTeam.id ? team2 : team1;
  const locked = !!lineupSubmission?.lockedAt && !lineupSubmission?.unlockedAt;
  const revealed = !!revealedLineup?.revealId || !!lineupSubmission?.revealedAt || (!!lineupSubmission?.lockedAt && !!opponentSubmission?.lockedAt);
  const status = statusForFixture(completed, lineupSubmission, opponentSubmission);
  const errors = validateDashboardLineup(captainTeam, selected, matches, teams, eligibilityRules);
  const names = selectedNames(captainTeam, selected);
  const canSubmit = !completed && !locked && errors.length === 0;
  const waText = whatsappMessage(captainTeam, opponent, captainTeam?.players?.find(p => p.isCaptain)?.name || captainTeam?.players?.[0]?.name || session.teamName, lineupSubmission, opponentSubmission, revealedLineup);
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  useEffect(() => {
    if (lineupSubmission?.selected) setSelected(lineupSubmission.selected);
  }, [lineupSubmission?.selected]);

  const optionErrors = useMemo(() => {
    const map = {};
    LINEUP_ROLE_SLOTS.forEach((_, slotIdx) => {
      (captainTeam?.players || []).forEach((player, playerIdx) => {
        const next = [...selected];
        next[slotIdx] = String(playerIdx);
        const nextErrors = validateDashboardLineup(captainTeam, next, matches, teams, eligibilityRules)
          .filter(error => !error.startsWith('Select all 5 lineup slots'));
        if (nextErrors.length > 0) map[`${slotIdx}:${playerIdx}`] = nextErrors[0];
      });
    });
    return map;
  }, [captainTeam, selected, matches, teams, eligibilityRules]);

  const applySmartFill = () => {
    const players = captainTeam?.players || [];
    const base = LINEUP_ROLE_SLOTS.map((_, idx) => selected[idx] || '');
    const used = new Set(base.filter(Boolean));
    if (used.size !== base.filter(Boolean).length) {
      setSelectionWarning('A player can only appear in one lineup role.');
      return;
    }

    const search = (idx, draft, usedPlayers) => {
      if (idx >= LINEUP_ROLE_SLOTS.length) {
        return validateDashboardLineup(captainTeam, draft, matches, teams, eligibilityRules).length === 0 ? draft : null;
      }
      if (draft[idx]) return search(idx + 1, draft, usedPlayers);
      for (let playerIdx = 0; playerIdx < players.length; playerIdx += 1) {
        const value = String(playerIdx);
        if (usedPlayers.has(value)) continue;
        const nextDraft = [...draft];
        const nextUsed = new Set(usedPlayers);
        nextDraft[idx] = value;
        nextUsed.add(value);
        const found = search(idx + 1, nextDraft, nextUsed);
        if (found) return found;
      }
      return null;
    };

    const filled = search(0, base, used);
    if (filled) {
      setSelected(filled);
      setSelectionWarning('');
      return;
    }
    setSelectionWarning('Smart fill could not find a valid lineup with the current roster and KOC eligibility limits. Adjust existing selections or review player capacity.');
  };

  const setSlot = (idx, value) => setSelected(prev => {
    const next = [...prev];
    next[idx] = value;
    const nextErrors = validateDashboardLineup(captainTeam, next, matches, teams, eligibilityRules)
      .filter(error => !error.startsWith('Select all 5 lineup slots'));
    setSelectionWarning(nextErrors[0] || '');
    return next;
  });

  const submitLineup = async () => {
    const validationErrors = validateDashboardLineup(captainTeam, selected, matches, teams, eligibilityRules);
    if (validationErrors.length) return;
    const now = Date.now();
    const revealId = null;
    const payload = {
      scheduleId: item.id,
      teamId: captainTeam.id,
      opponentTeamId: opponent?.id || '',
      selected,
      lineup: buildDashboardLineupLines(names),
      submissionStatus: 'submitted_locked',
      submittedAt: now,
      lockedAt: now,
      whatsappShared: lineupSubmission?.whatsappShared || false,
      validationErrors: [],
      lastUpdatedAt: now,
      version: (lineupSubmission?.version || 0) + 1,
      revealedAt: lineupSubmission?.revealedAt || null,
      revealId
    };
    const metaPayload = {
      scheduleId: item.id,
      teamId: captainTeam.id,
      opponentTeamId: opponent?.id || '',
      submissionStatus: payload.submissionStatus,
      submittedAt: now,
      lockedAt: now,
      whatsappShared: payload.whatsappShared,
      whatsappSharedAt: lineupSubmission?.whatsappSharedAt || null,
      lastUpdatedAt: now,
      version: payload.version,
      revealedAt: payload.revealedAt,
      revealId: payload.revealId
    };
    const updates = {
      [`${PATHS.lineupSubmissions}/${item.id}/${captainTeam.id}`]: payload,
      [`${PATHS.lineupSubmissionMeta}/${item.id}/${captainTeam.id}`]: metaPayload
    };
    try {
      setBusy(true);
      await ensureAuth();
      await update(ref(db), updates);
      await writeAuditLog({ actionType: 'Lineup Submitted & Locked', session, targetType: 'schedule', targetId: item.id, newValue: { scheduleId: item.id, teamId: captainTeam.id, submittedAt: now, lockedAt: now, revealedAt: payload.revealedAt } });
      setMessage('✅ Submitted & Locked');
    } catch (e) {
      setMessage(`Save failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const markWhatsappShared = async () => {
    const now = Date.now();
    try {
      await ensureAuth();
      await update(ref(db), { [`${PATHS.lineupSubmissions}/${item.id}/${captainTeam.id}/whatsappShared`]: true, [`${PATHS.lineupSubmissions}/${item.id}/${captainTeam.id}/whatsappSharedAt`]: now, [`${PATHS.lineupSubmissions}/${item.id}/${captainTeam.id}/lastUpdatedAt`]: now, [`${PATHS.lineupSubmissionMeta}/${item.id}/${captainTeam.id}/whatsappShared`]: true, [`${PATHS.lineupSubmissionMeta}/${item.id}/${captainTeam.id}/whatsappSharedAt`]: now, [`${PATHS.lineupSubmissionMeta}/${item.id}/${captainTeam.id}/lastUpdatedAt`]: now });
      await writeAuditLog({ actionType: 'Lineup WhatsApp Shared', session, targetType: 'schedule', targetId: item.id, newValue: { scheduleId: item.id, teamId: captainTeam.id, whatsappSharedAt: now } });
    } catch (e) {
      setMessage(`WhatsApp status failed: ${e.message}`);
    }
  };

  return (
    <article className="captain-fixture-card" data-testid={`captain-fixture-${item.id}`}>
      <div className="captain-fixture-main">
        <span className="rl-ic" aria-hidden="true">📅</span>
        <div style={{ flex: 1 }}>
          <div className="rl-lbl">Round {item.round || '—'} · {formatDate(item.date)} · {item.time || 'TBD'}</div>
          <div className="rl-val">{team1?.name || 'TBD'} <strong>vs</strong> {team2?.name || 'TBD'} · Group {item.group || team1?.group || team2?.group || '—'}</div>
          <div className="dashboard-status-row"><span className={status.className}>{status.label}</span><span>Opponent Submission Status: {opponentSubmission?.submittedAt ? 'Submitted' : 'Waiting...'}</span>{opponentSubmission?.submittedAt && <span>Submitted At {timeLabel(opponentSubmission.submittedAt)}</span>}</div>
        </div>
        <div className="captain-fixture-actions">
          {!completed && !locked && <button type="button" className="btn small" onClick={() => setExpanded(v => !v)} data-testid={`submit-lines-${item.id}`}>{expanded ? 'Hide Lines' : 'Submit Lines'}</button>}
          {locked && <button type="button" className="btn small ghost" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide' : 'View Status'}</button>}
          {revealed && !completed ? <Link className="btn small success" to="/score" data-testid={`submit-score-${item.id}`}>Submit Score</Link> : <button type="button" className="btn small ghost" disabled data-testid={`submit-score-${item.id}`}>Submit Score</button>}
          <button type="button" className="btn small ghost" onClick={() => setShowOpponentCapacity(v => !v)} data-testid={`toggle-opponent-capacity-${item.id}`}>{showOpponentCapacity ? 'Hide Opponent Capacity' : 'Show Opponent Capacity'}</button>
        </div>
      </div>
      {showOpponentCapacity && <OpponentCapacityPreview opponent={opponent} teams={teams} matches={matches} eligibilityRules={eligibilityRules} lineupSubmissions={{ [item.id]: { [opponent?.id]: opponentSubmission } }} />}
      {expanded && (
        <div className="dashboard-lineup-drawer">
          {message && <div className={message.startsWith('✅') ? 'success-box' : 'error-box'}>{message}</div>}
          {!locked ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.5rem' }}><button type='button' className='btn small ghost' onClick={applySmartFill} disabled={busy} data-testid={`dashboard-lineup-smart-fill-${item.id}`}>Smart fill</button></div>
              <LineupRoleSelect team={captainTeam} selected={selected} onChange={setSlot} readOnly={busy} optionErrors={optionErrors} />
              {selectionWarning && <div className="error-box" style={{ whiteSpace: 'pre-line' }} data-testid={`lineup-selection-warning-${item.id}`}>{selectionWarning}</div>}
              {errors.length > 0 && <div className="error-box" style={{ whiteSpace: 'pre-line' }}>{errors.join('\n')}</div>}
              <div className="dashboard-sticky-actions"><button className="btn success full" disabled={!canSubmit || busy} onClick={submitLineup} data-testid={`lock-lineup-${item.id}`}>{busy ? 'Submitting...' : 'Submit & Lock Lineup'}</button></div>
            </>
          ) : (
            <div className="dashboard-submitted-panel">
              <h3>✅ Submitted & Locked</h3>
              <p>Submitted<br /><strong>{timeLabel(lineupSubmission.submittedAt)}</strong></p>
              <p>WhatsApp<br /><strong>{revealed ? (lineupSubmission.whatsappShared ? `WhatsApp Shared ${timeLabel(lineupSubmission.whatsappSharedAt)}` : 'Not Shared') : 'Available after both teams lock'}</strong></p>
              {revealed && <a className="btn success" href={waHref} target="_blank" rel="noreferrer" onClick={markWhatsappShared} data-testid={`share-lineup-whatsapp-${item.id}`}>Share via WhatsApp</a>}
              <button className="btn ghost" type="button" onClick={onRefresh}>Refresh</button>
              <p className="hint">Last Updated<br />{timeLabel(lineupSubmission.lastUpdatedAt)}</p>
              {revealed && <div className="lineup-reveal"><h4>Revealed Lineups {lineupSubmission?.revealId ? `· Code ${lineupSubmission.revealId.slice(-8).toUpperCase()}` : ''}</h4>{revealedRecordRows(revealedLineup, captainTeam.id, opponent?.id, lineupSubmission, opponentSubmission).map(row => <div key={row.label}><strong>{row.label}:</strong> {row.mine.join(' / ')} <strong>vs</strong> {row.theirs.join(' / ')}</div>)}</div>}
              {!revealed && <p className="hint">Lineup details and WhatsApp sharing stay hidden until both captains submit and lock.</p>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ScheduleMiniList({ title, description, fixtures, teams, emptyText, testid, showStatus = false }) {
  return (
    <section className="card" data-testid={testid}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'flex-start', marginBottom: '.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {description && <p className="hint" style={{ margin: '.25rem 0 0' }}>{description}</p>}
        </div>
        <Link className="btn small ghost" to="/schedule">Full schedule</Link>
      </div>
      {fixtures.length === 0 ? <div className="muted center">{emptyText}</div> : (
        <div style={{ display: 'grid', gap: '.55rem' }}>
          {fixtures.map(item => {
            const { team1, team2 } = fixtureTeams(item, teams);
            return (
              <div key={item.id} className="rl-item" data-testid={`home-fixture-${item.id}`}>
                <span className="rl-ic" aria-hidden="true">📅</span>
                <div>
                  <div className="rl-lbl">Round {item.round || '—'} · {formatDate(item.date)} · {item.time || 'TBD'}</div>
                  <div className="rl-val">{team1?.name || 'TBD'} <strong>vs</strong> {team2?.name || 'TBD'} · Group {item.group || team1?.group || team2?.group || '—'}{showStatus && <span className="tag" style={{ marginLeft: '.35rem' }}>{item.homeStatus || (item.status === 'completed' ? 'Completed' : 'Upcoming')}</span>}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CaptainScheduleList({ fixtures, completedFixtures, teams, captainTeam, lineupSubmissions, revealedLineups, matches, eligibilityRules, session, lastRefreshed, onRefresh }) {
  return (
    <section className="card" data-testid="captain-scheduled-matches-card">
      <div className="dashboard-section-head">
        <div><h2>Scheduled Matches</h2><p className="hint">Submit and lock one official lineup per match schedule ID.</p></div>
        <div className="dashboard-refresh"><button className="btn small ghost" onClick={onRefresh}>Refresh</button><span className="hint">Last Refreshed {timeLabel(lastRefreshed)}</span></div>
      </div>
      {fixtures.length === 0 ? <div className="muted center">No scheduled matches found for your team.</div> : (
        <div className="captain-fixture-list">
          {fixtures.map(item => {
            const opponentId = item.team1Id === captainTeam.id ? item.team2Id : item.team1Id;
            return <CaptainFixtureCard key={item.id} item={item} teams={teams} captainTeam={captainTeam} completed={false} lineupSubmission={lineupSubmissions?.[item.id]?.[captainTeam.id]} opponentSubmission={lineupSubmissions?.[item.id]?.[opponentId]} revealedLineup={Object.values(revealedLineups || {}).find(row => row.scheduleId === item.id)} matches={matches} eligibilityRules={eligibilityRules} session={session} onRefresh={onRefresh} />;
          })}
        </div>
      )}
      <div style={{ marginTop: '1rem' }}>
        <ScheduleMiniList title="Completed Matches" description="Completed fixtures for your team." fixtures={completedFixtures} teams={teams} emptyText="No completed fixtures yet." testid="captain-completed-schedule-card" showStatus />
      </div>
    </section>
  );
}


function TeamSnapshot({ team, upcomingCount, completedCount, capacityRows }) {
  const rosterCount = team?.players?.length || 0;
  const blockedCount = capacityRows.filter(row => row.warnings.some(message => message.includes('reached'))).length;
  const warningCount = capacityRows.filter(row => row.warnings.length).length;
  return (
    <section className="card" data-testid="captain-team-snapshot">
      <h2>Team Snapshot</h2>
      <div className="rl-grid" style={{ marginTop: '.75rem' }}>
        <div className="rl-item"><span className="rl-ic" aria-hidden="true">👥</span><div><div className="rl-lbl">Roster</div><div className="rl-val">{rosterCount} players · Captain: {team.players?.[0]?.name || team.captain || 'TBD'}</div></div></div>
        <div className="rl-item"><span className="rl-ic" aria-hidden="true">🏷️</span><div><div className="rl-lbl">Group / Auction</div><div className="rl-val">Group {team.group || '—'} · Spent ${Number(team.totalSpent || 0).toLocaleString()} · Left ${Number(team.moneyLeft || 0).toLocaleString()}</div></div></div>
        <div className="rl-item"><span className="rl-ic" aria-hidden="true">📅</span><div><div className="rl-lbl">Schedule</div><div className="rl-val">{upcomingCount} upcoming · {completedCount} completed</div></div></div>
        <div className="rl-item"><span className="rl-ic" aria-hidden="true">🚨</span><div><div className="rl-lbl">Capacity Risk</div><div className="rl-val">{blockedCount} capped · {warningCount} with warnings</div></div></div>
      </div>
    </section>
  );
}

function OwnerGaps({ overdueFixtures, capacityRows }) {
  const cappedPlayers = capacityRows.filter(row => row.warnings.some(message => message.includes('reached')));
  const nearCapPlayers = capacityRows.filter(row => row.warnings.length && !row.warnings.some(message => message.includes('reached')));
  return (
    <section className="card" data-testid="captain-owner-gaps">
      <h2>Owner Checks</h2>
      <p className="hint">Tight checklist before lines or score entry.</p>
      <div style={{ display: 'grid', gap: '.5rem' }}>
        {overdueFixtures.length > 0 && (
          <div className="rl-flag warn"><span aria-hidden="true">⏰</span><span>{overdueFixtures.length} past fixture(s) still need a completed/approved score.</span></div>
        )}
        {cappedPlayers.length > 0 && (
          <div className="rl-flag warn"><span aria-hidden="true">🚫</span><span>{cappedPlayers.length} player(s) are already at a hard capacity cap. Do not place them in capped lines.</span></div>
        )}
        {nearCapPlayers.length > 0 && (
          <div className="rl-flag warn"><span aria-hidden="true">⚠️</span><span>{nearCapPlayers.length} player(s) are one use away from a cap. Double-check lineup balance.</span></div>
        )}
        {overdueFixtures.length === 0 && cappedPlayers.length === 0 && nearCapPlayers.length === 0 && (
          <div className="rl-flag ok"><span aria-hidden="true">✅</span><span>No owner gaps detected right now.</span></div>
        )}
      </div>
    </section>
  );
}

function DangerBells({ rows }) {
  const warnings = rows
    .filter(row => row.warnings.length)
    .flatMap(row => row.warnings.map(message => ({ player: row.name, message })));
  return (
    <section className="card" data-testid="captain-danger-bells">
      <h2>🚨 Danger Bells</h2>
      <p className="hint">Players at or near eligibility capacity before you set lines.</p>
      {warnings.length === 0 ? (
        <div className="rl-flag ok"><span aria-hidden="true">✅</span><span>No capacity danger bells right now.</span></div>
      ) : (
        <div style={{ display: 'grid', gap: '.5rem' }}>
          {warnings.map((warning, idx) => (
            <div key={`${warning.player}-${warning.message}-${idx}`} className="rl-flag warn">
              <span aria-hidden="true">⚠️</span>
              <span><strong>{warning.player}</strong>: {warning.message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home({ teams, schedule, matches = [], eligibilityRules = DEFAULT_ELIGIBILITY_RULES, lineupSubmissions = {}, revealedLineups = {}, lastRefreshed = Date.now(), onRefresh = () => {} }) {
  const { session } = useAuth();
  const scheduleItems = useMemo(() => Object.values(schedule || {}).filter(item => item?.type !== 'buffer'), [schedule]);
  const sortedFixtures = useMemo(() => [...scheduleItems].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || ''))), [scheduleItems]);
  const captainTeam = hasRole(session, [ROLES.CAPTAIN]) ? teams?.[session.teamId] : null;
  const captainFixtures = useMemo(() => {
    if (!captainTeam) return [];
    return sortedFixtures.filter(item => item.team1Id === captainTeam.id || item.team2Id === captainTeam.id);
  }, [captainTeam, sortedFixtures]);
  const completedFixtureKeys = useMemo(() => {
    const keys = new Set();
    approvedMatches(matches).forEach(match => {
      const { team1, team2 } = resolveMatchTeams(match, teams);
      if (team1?.id && team2?.id) keys.add(pairKey(team1.id, team2.id));
    });
    return keys;
  }, [matches, teams]);
  const completedCaptainFixtures = useMemo(() => captainFixtures
    .filter(item => item.status === 'completed' || completedFixtureKeys.has(pairKey(item.team1Id, item.team2Id)))
    .map(item => ({ ...item, homeStatus: 'Completed' })), [captainFixtures, completedFixtureKeys]);
  const upcomingCaptainFixtures = useMemo(() => captainFixtures
    .filter(item => item.status !== 'completed' && !completedFixtureKeys.has(pairKey(item.team1Id, item.team2Id)))
    .map(item => ({ ...item, homeStatus: 'Upcoming' })), [captainFixtures, completedFixtureKeys]);
  const overdueFixtures = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return upcomingCaptainFixtures.filter(item => {
      if (!item.date) return false;
      const [y, m, d] = item.date.split('-').map(Number);
      const fixtureDate = new Date(y, m - 1, d);
      return fixtureDate < today;
    });
  }, [upcomingCaptainFixtures]);
  const capacityRows = useMemo(() => captainTeam ? buildCaptainCapacityRows(captainTeam, teams, matches, eligibilityRules, lineupSubmissions) : [], [captainTeam, teams, matches, eligibilityRules, lineupSubmissions]);

  useEffect(() => {
    if (!captainTeam) return undefined;
    const id = setInterval(onRefresh, 120000); // auto-refresh captain dashboard every 2 minutes
    return () => clearInterval(id);
  }, [captainTeam, onRefresh]);

  if (captainTeam) {
    return (
      <main className="container" data-testid="captain-dashboard-page">
        <div className="page-title">
          <h1>Captain Dashboard</h1>
          <p>{captainTeam.name} · your schedule, capacity, and lineup danger bells.</p>
        </div>
        <TeamSnapshot team={captainTeam} upcomingCount={upcomingCaptainFixtures.length} completedCount={completedCaptainFixtures.length} capacityRows={capacityRows} />
        <CaptainScheduleList fixtures={upcomingCaptainFixtures} completedFixtures={completedCaptainFixtures} teams={teams} captainTeam={captainTeam} lineupSubmissions={lineupSubmissions} revealedLineups={revealedLineups} matches={matches} eligibilityRules={eligibilityRules} session={session} lastRefreshed={lastRefreshed} onRefresh={onRefresh} />
        <OwnerGaps overdueFixtures={overdueFixtures} capacityRows={capacityRows} />
        <DangerBells rows={capacityRows} />
        <CaptainCapacityCard team={captainTeam} teams={teams} matches={matches} eligibilityRules={eligibilityRules} lineupSubmissions={lineupSubmissions} />
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Link className="btn" to="/score">Enter score</Link>
          <Link className="btn ghost" to="/schedule">Open schedule</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container" data-testid="public-home-page">
      <div className="page-title">
        <h1>KOC3 / PPRC Tennis</h1>
        <p>Public landing page: all league schedules are visible without login.</p>
      </div>
      <ScheduleMiniList
        title="All Schedules"
        description="Sign in as a captain to see only your fixtures, capacity, and danger bells."
        fixtures={sortedFixtures}
        teams={teams}
        emptyText="No fixtures are available yet."
        testid="public-schedule-card"
      />
    </main>
  );
}
