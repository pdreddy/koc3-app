import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole } from '../utils/roles';
import { DEFAULT_ELIGIBILITY_RULES } from '../utils/eligibilityRules';
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
      {fixtures.length === 0 ? (
        <div className="muted center">{emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gap: '.55rem' }}>
          {fixtures.map(item => {
            const { team1, team2 } = fixtureTeams(item, teams);
            return (
              <div key={item.id} className="rl-item" data-testid={`home-fixture-${item.id}`}>
                <span className="rl-ic" aria-hidden="true">📅</span>
                <div>
                  <div className="rl-lbl">Round {item.round || '—'} · {formatDate(item.date)} · {item.time || 'TBD'}</div>
                  <div className="rl-val">
                    {team1?.name || 'TBD'} <strong>vs</strong> {team2?.name || 'TBD'} · Group {item.group || team1?.group || team2?.group || '—'}
                    {showStatus && <span className="tag" style={{ marginLeft: '.35rem' }}>{item.homeStatus || (item.status === 'completed' ? 'Completed' : 'Upcoming')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function lineupStorageKey(matchScheduleId, teamId) {
  return `koc3-lineup:${matchScheduleId}:${teamId}`;
}

function readStoredLineup(matchScheduleId, teamId) {
  try {
    return JSON.parse(localStorage.getItem(lineupStorageKey(matchScheduleId, teamId)) || 'null');
  } catch (err) {
    return null;
  }
}

function writeStoredLineup(matchScheduleId, teamId, value) {
  localStorage.setItem(lineupStorageKey(matchScheduleId, teamId), JSON.stringify(value));
}

const LINEUP_SLOTS = [
  { key: 'singles', label: 'Singles', count: 1 },
  { key: 'doubles1', label: 'Doubles 1', count: 2 },
  { key: 'doubles2', label: 'Doubles 2', count: 2 },
  { key: 'reverseDoubles', label: 'Reverse Doubles', count: 2 },
  { key: 'reverseSingles', label: 'Reverse Singles', count: 1 }
];

function emptyLineup() {
  return LINEUP_SLOTS.reduce((acc, slot) => ({ ...acc, [slot.key]: Array(slot.count).fill('') }), {});
}

function flattenLineup(lineup) {
  return LINEUP_SLOTS.flatMap(slot => lineup?.[slot.key] || []).filter(Boolean);
}

function validateCaptainLineup(lineup, team, capacityRows) {
  const errors = [];
  LINEUP_SLOTS.forEach(slot => {
    const names = lineup?.[slot.key] || [];
    if (names.filter(Boolean).length !== slot.count) errors.push(`${slot.label} requires ${slot.count} player${slot.count > 1 ? 's' : ''}.`);
  });
  const picked = flattenLineup(lineup);
  const duplicates = picked.filter((name, idx) => picked.indexOf(name) !== idx);
  [...new Set(duplicates)].forEach(name => errors.push(`${name} is assigned more than once in this lineup.`));
  const rosterNames = new Set((team?.players || []).map(player => player.name));
  picked.filter(name => !rosterNames.has(name)).forEach(name => errors.push(`${name} is not on your roster.`));
  capacityRows.forEach(row => {
    if (picked.includes(row.name) && row.warnings.some(message => message.includes('reached'))) {
      errors.push(`${row.name} is blocked by an existing KOC capacity rule.`);
    }
  });
  if ((lineup?.singles || []).length > 2) errors.push('Maximum 2 Singles is enforced.');
  return errors;
}

function StatusBadge({ status }) {
  const meta = {
    notSubmitted: ['🟢', 'Not Submitted'],
    locked: ['🟡', 'Submitted & Locked'],
    waiting: ['🔵', 'Waiting for Opponent'],
    revealed: ['🟣', 'Revealed'],
    completed: ['⚫', 'Completed']
  }[status] || ['🟢', 'Not Submitted'];
  return <span className={`line-status ${status}`}>{meta[0]} {meta[1]}</span>;
}

function LineupDisplay({ title, lineup }) {
  return (
    <div className="lineup-reveal-panel">
      <h4>{title}</h4>
      {LINEUP_SLOTS.map(slot => <div key={slot.key} className="lineup-read-row"><strong>{slot.label}</strong><span>{(lineup?.[slot.key] || []).join(' / ') || 'Hidden until reveal'}</span></div>)}
    </div>
  );
}

function CaptainMatchCard({ item, teams, captainTeam, capacityRows }) {
  const { team1, team2 } = fixtureTeams(item, teams);
  const opponent = team1?.id === captainTeam.id ? team2 : team1;
  const matchScheduleId = item.id;
  const [expanded, setExpanded] = useState(false);
  const [lineup, setLineup] = useState(emptyLineup);
  const [submission, setSubmission] = useState(() => readStoredLineup(matchScheduleId, captainTeam.id));
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const errors = validateCaptainLineup(lineup, captainTeam, capacityRows);
  const opponentSubmission = readStoredLineup(matchScheduleId, opponent?.id);
  const revealed = submission?.lockedAt && opponentSubmission?.lockedAt;
  const status = item.status === 'completed' ? 'completed' : revealed ? 'revealed' : submission?.lockedAt ? 'locked' : 'notSubmitted';
  const whatsappText = encodeURIComponent(`KOC Match\n\n${captainTeam.name} vs ${opponent?.name || 'Opponent'}\n\nCaptain:\n${captainTeam.players?.[0]?.name || captainTeam.captain || 'Captain'}\n\nOur official lineup has been submitted through the KOC App.\n\nPlease submit your lineup through the app.\n\nThe KOC App remains the official source of truth.`);

  useEffect(() => {
    const timer = setInterval(() => setLastRefreshed(new Date()), 120000);
    return () => clearInterval(timer);
  }, []);

  function updateSlot(key, index, value) {
    setLineup(current => ({ ...current, [key]: current[key].map((entry, idx) => idx === index ? value : entry) }));
  }

  function submitLineup() {
    const now = new Date().toISOString();
    const payload = { matchScheduleId, teamId: captainTeam.id, lineup, submissionStatus: 'Submitted & Locked', submittedAt: now, lockedAt: now, lastUpdatedAt: now, validationErrors: [] };
    writeStoredLineup(matchScheduleId, captainTeam.id, payload);
    setSubmission(payload);
  }

  function markWhatsappShared() {
    const now = new Date().toISOString();
    const next = { ...submission, whatsappShared: true, whatsappSharedAt: now, lastUpdatedAt: now };
    writeStoredLineup(matchScheduleId, captainTeam.id, next);
    setSubmission(next);
  }

  return (
    <article className="captain-match-card" data-testid={`captain-match-${matchScheduleId}`}>
      <div className="captain-match-top">
        <div>
          <div className="round-chip">Round {item.round || '—'} · Match Schedule ID {matchScheduleId}</div>
          <h3>{team1?.name || 'TBD'} vs {team2?.name || 'TBD'}</h3>
          <div className="match-meta"><span>{formatDate(item.date)}</span><span>{item.time || 'TBD'}</span><span>{item.location || item.court || 'Prosper Courts'}</span></div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="opponent-strip"><strong>Opponent Submission Status</strong><span>{opponentSubmission?.lockedAt ? `Submitted · ${formatTime(opponentSubmission.lockedAt)}` : 'Waiting...'}</span></div>
      {item.status !== 'completed' && !submission?.lockedAt && <button type="button" className="btn submit-lines-btn" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide Lines' : 'Submit Lines'}</button>}
      {expanded && !submission?.lockedAt && (
        <div className="inline-lineup-editor">
          {LINEUP_SLOTS.map(slot => <div key={slot.key} className="lineup-slot"><label>{slot.label}</label>{slot.count === 1 ? <select className="select" value={lineup[slot.key][0]} onChange={e => updateSlot(slot.key, 0, e.target.value)}><option value="">Player</option>{captainTeam.players?.map(player => <option key={player.name} value={player.name}>{player.name}</option>)}</select> : <div className="lineup-pair">{[0,1].map(idx => <select key={idx} className="select" value={lineup[slot.key][idx]} onChange={e => updateSlot(slot.key, idx, e.target.value)}><option value="">Player {idx ? 'B' : 'A'}</option>{captainTeam.players?.map(player => <option key={player.name} value={player.name}>{player.name}</option>)}</select>)}</div>}</div>)}
          {errors.length > 0 && <div className="error-box">{errors.map(error => <div key={error}>{error}</div>)}</div>}
          <div className="sticky-actions"><button type="button" className="btn ghost" disabled={errors.length > 0}>Validate</button><button type="button" className="btn" disabled={errors.length > 0} onClick={submitLineup}>Submit & Lock Lineup</button></div>
        </div>
      )}
      {submission?.lockedAt && !revealed && <div className="submitted-panel"><h3>✅ Submitted & Locked</h3><p>Submitted <strong>{formatTime(submission.submittedAt)}</strong></p><p>WhatsApp <strong>{submission.whatsappShared ? `Shared · ${formatTime(submission.whatsappSharedAt)}` : 'Not Shared'}</strong></p><a className="btn whatsapp-btn" href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noreferrer" onClick={markWhatsappShared}>Share via WhatsApp</a></div>}
      {revealed && <div className="reveal-grid"><LineupDisplay title="Your Lineup" lineup={submission.lineup} /><LineupDisplay title="Opponent Lineup" lineup={opponentSubmission.lineup} /></div>}
      <div className="refresh-row"><button type="button" className="btn small ghost" onClick={() => setLastRefreshed(new Date())}>Refresh</button><span>Last Refreshed {formatTime(lastRefreshed)}</span></div>
    </article>
  );
}

function CaptainScheduledMatches({ fixtures, teams, captainTeam, capacityRows }) {
  return <section className="captain-dashboard-section"><h2>Scheduled Matches</h2>{fixtures.length === 0 ? <div className="card muted center">No scheduled matches found for your team.</div> : fixtures.map(item => <CaptainMatchCard key={item.id} item={item} teams={teams} captainTeam={captainTeam} capacityRows={capacityRows} />)}</section>;
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

export default function Home({ teams, schedule, matches = [], eligibilityRules = DEFAULT_ELIGIBILITY_RULES }) {
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
  const capacityRows = useMemo(() => captainTeam ? buildCaptainCapacityRows(captainTeam, teams, matches, eligibilityRules) : [], [captainTeam, teams, matches, eligibilityRules]);

  if (captainTeam) {
    return (
      <main className="container" data-testid="captain-dashboard-page">
        <div className="page-title">
          <h1>Captain Dashboard</h1>
          <p>{captainTeam.name} · your schedule, capacity, and lineup danger bells.</p>
        </div>
        <TeamSnapshot team={captainTeam} upcomingCount={upcomingCaptainFixtures.length} completedCount={completedCaptainFixtures.length} capacityRows={capacityRows} />
        <CaptainScheduledMatches fixtures={upcomingCaptainFixtures} teams={teams} captainTeam={captainTeam} capacityRows={capacityRows} />
        <ScheduleMiniList
          title="Completed Matches"
          description="Completed matches for your team."
          fixtures={completedCaptainFixtures}
          teams={teams}
          emptyText="No completed matches yet."
          testid="captain-completed-schedule-card"
          showStatus
        />
        <OwnerGaps overdueFixtures={overdueFixtures} capacityRows={capacityRows} />
        <DangerBells rows={capacityRows} />
        <CaptainCapacityCard team={captainTeam} teams={teams} matches={matches} eligibilityRules={eligibilityRules} />
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
