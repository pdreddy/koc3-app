import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole } from '../utils/roles';
import { DEFAULT_ELIGIBILITY_RULES } from '../utils/eligibilityRules';
import { approvedMatches } from '../utils/matchStatus';
import { resolveMatchTeams } from '../utils/matchTeams';
import { buildCaptainCapacityRows } from '../components/CaptainCapacity';
import TeamShield from '../components/TeamShield';
import { getRevealedLineupSubmission, readStoredLineup, writeStoredLineup } from '../utils/lineupSubmissions';

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

function PremiumLineupTile({ icon, title, subtitle, tone = 'blue', onClick }) {
  return (
    <button type="button" className={`premium-lineup-tile ${tone}`} onClick={onClick}>
      <span className="tile-icon">{icon}</span>
      <span><strong>{title}</strong><small>{subtitle}</small></span>
      <b>+</b>
    </button>
  );
}

function PremiumCaptainDashboard({ captainTeam, upcomingFixtures, completedFixtures, teams, capacityRows }) {
  const nextMatch = upcomingFixtures[0];
  const { team1, team2 } = nextMatch ? fixtureTeams(nextMatch, teams) : {};
  const opponent = team1?.id === captainTeam.id ? team2 : team1;
  const matchScheduleId = nextMatch?.id;
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [submission, setSubmission] = useState(() => readStoredLineup(matchScheduleId, captainTeam.id));
  const opponentSubmission = readStoredLineup(matchScheduleId, opponent?.id);
  const reveal = getRevealedLineupSubmission(matchScheduleId, team1?.id, team2?.id);
  const status = reveal ? 'REVEALED' : submission?.lockedAt ? 'SUBMITTED & LOCKED' : 'NOT SUBMITTED';
  const whatsappText = encodeURIComponent(`KOC Match\n\n${captainTeam.name} vs ${opponent?.name || 'Opponent'}\n\nCaptain:\n${captainTeam.players?.[0]?.name || captainTeam.captain || 'Captain'}\n\nOur official lineup has been submitted through the KOC App.\n\nPlease submit your lineup through the app.\n\nThe KOC App remains the official source of truth.`);

  useEffect(() => {
    const timer = setInterval(() => setLastRefreshed(new Date()), 120000);
    return () => clearInterval(timer);
  }, []);

  function quickLockDemo() {
    if (!matchScheduleId || submission?.lockedAt) return;
    const roster = captainTeam.players || [];
    const pick = (idx) => roster[idx]?.name || '';
    const now = new Date().toISOString();
    const lineup = {
      singles: [pick(0)],
      doubles1: [pick(1), pick(2)],
      doubles2: [pick(3), pick(4)],
      reverseDoubles: [pick(5), pick(6)],
      reverseSingles: [pick(7)]
    };
    const payload = { matchScheduleId, teamId: captainTeam.id, lineup, submissionStatus: 'Submitted & Locked', submittedAt: now, lockedAt: now, revealedAt: opponentSubmission?.lockedAt ? now : null, lastUpdatedAt: now, validationErrors: [] };
    writeStoredLineup(matchScheduleId, captainTeam.id, payload);
    setSubmission(payload);
  }

  if (!nextMatch) {
    return (
      <main className="container captain-premium-page" data-testid="captain-dashboard-page">
        <section className="captain-topbar"><div className="hamburger">☰</div><div className="koc-wordmark">♛<strong>KOC</strong><small>SEASON 3</small></div><div className="captain-title"><h1>Captain Dashboard</h1><p>Season 3</p></div><div className="captain-bells">🔔<b>3</b></div><div className="captain-avatar">🎾</div></section>
        <section className="captain-hero-card"><h2>No scheduled matches</h2><p className="hint">Your completed matches are listed below.</p></section>
      </main>
    );
  }

  return (
    <main className="container captain-premium-page" data-testid="captain-dashboard-page">
      <section className="captain-topbar">
        <div className="hamburger">☰</div>
        <div className="koc-wordmark">♛<strong>KOC</strong><small>SEASON 3</small></div>
        <div className="captain-title"><h1>Captain Dashboard</h1><p>Season 3</p></div>
        <div className="captain-bells">🔔<b>3</b></div>
        <div className="captain-avatar">🎾</div>
      </section>

      <section className="captain-hero-card">
        <div className="hero-icon">▣</div>
        <div className="hero-main"><span>Next Match</span><h2>{team1?.name || 'TBD'} vs {team2?.name || 'TBD'}</h2><p>▣ {formatDate(nextMatch.date)} &nbsp;&nbsp; ◷ {nextMatch.time || '07:30 PM'} &nbsp;&nbsp; ♙ {nextMatch.location || nextMatch.court || 'KOC Arena 1'}</p></div>
        <div className="hero-side"><span className="scheduled-pill">SCHEDULED</span><div className="countdown-box"><b>02</b><b>15</b><b>42</b><small>HRS</small><small>MIN</small><small>SEC</small></div></div>
      </section>

      <nav className="captain-tabbar" aria-label="Captain dashboard sections">
        <a className="active" href="#scheduled">▣ Scheduled Matches</a><a href="#completed">♕ Completed Matches</a><a href="#tournament">◈ Tournament</a><a href="#standings">▥ Standings</a>
      </nav>

      <div className="captain-dashboard-grid" id="scheduled">
        <section className="premium-match-console">
          <div className="round-badge">Round {nextMatch.round || '3'}</div><button className="collapse-caret" type="button">⌃</button>
          <div className="premium-versus-row">
            <div className="team-lockup"><TeamShield team={team1} size="lg" /><div><h2>{team1?.name || 'TBD'} <span>YOU</span></h2><p>Captain: {team1?.players?.[0]?.name || team1?.captain || 'John'}</p></div></div>
            <div className="vs-orb">VS</div>
            <div className="team-lockup right"><div><h2>{team2?.name || 'TBD'}</h2><p>Captain: {team2?.players?.[0]?.name || team2?.captain || 'Mike'}</p></div><TeamShield team={team2} size="lg" /></div>
          </div>
          <div className="match-info-strip"><div>▣<span>Date</span><strong>{formatDate(nextMatch.date)}</strong></div><div>◷<span>Time</span><strong>{nextMatch.time || '06:30 PM'}</strong></div><div>◌<span>Court</span><strong>{nextMatch.location || nextMatch.court || 'Prosper Courts'}</strong></div><div><span>Match Status</span><em>{status}</em></div></div>
          <div className="submit-panel">
            <div className="panel-head"><h3>Submit Your Lineup</h3><strong>Submit before 05:30 PM</strong></div>
            <div className="premium-lineup-grid"><PremiumLineupTile icon="🎾" title="SINGLES 1" subtitle="Select Player" tone="green" /><PremiumLineupTile icon="🎾" title="SINGLES 2" subtitle="Select Player" tone="lime" /><PremiumLineupTile icon="👥" title="DOUBLES 1" subtitle="Select 2 Players" tone="purple" /><PremiumLineupTile icon="👥" title="DOUBLES 2" subtitle="Select 2 Players" tone="blue" /><PremiumLineupTile icon="👑" title="REVERSE DOUBLES" subtitle="Select 2 Players" tone="gold" /><PremiumLineupTile icon="🎾" title="REVERSE SINGLES" subtitle="Select Player" tone="pink" /></div>
            <div className="lineup-actions"><button className="btn ghost" type="button">♡ Validate Lineup</button><button className="btn" type="button" onClick={quickLockDemo}>▣ Submit & Lock Lineup</button></div><p className="submission-note">ⓘ After submission, you cannot edit your lineup.</p>
          </div>
          <div className="status-panels"><div className="status-panel mine"><h3>Your Submission Status</h3><div><span className="lock-orb">🔒</span><p><strong>{submission?.lockedAt ? 'Submitted & Locked' : 'Not Submitted'}</strong><small>{submission?.submittedAt ? `Submitted ${formatTime(submission.submittedAt)}` : 'Submit your lineup before the deadline.'}</small></p></div></div><div className="status-panel opponent"><h3>Opponent Submission Status</h3><div><span className="hourglass-orb">⌛</span><p><strong>{opponentSubmission?.lockedAt ? 'Submitted' : 'Waiting for Opponent'}</strong><small>{opponentSubmission?.lockedAt ? `Submitted ${formatTime(opponentSubmission.lockedAt)}` : 'Opponent has not submitted yet.'}</small></p></div></div></div>
        </section>
        <aside className="captain-side-panel"><h3>Match Timeline</h3><ol className="timeline"><li><span></span><p>Lineup Deadline<small>25 May 2025, 05:30 PM</small></p></li><li className="done"><span></span><p>Your Submission<small>{submission?.lockedAt ? 'Submitted' : 'Not Submitted'}</small></p></li><li><span></span><p>Opponent Submission<small>{opponentSubmission?.lockedAt ? 'Submitted' : 'Waiting...'}</small></p></li><li><span></span><p>Lineups Revealed<small>After both submissions</small></p></li></ol><div className="how-it-works"><h3>How It Works</h3><p>🖊️ <strong>1. Submit your lineup</strong><br />Enter and lock before the deadline.</p><p>💬 <strong>2. Share on WhatsApp</strong><br />Notify your opponent.</p><p>🛡️ <strong>3. Opponent submits</strong><br />Waiting stays blind.</p><p>🔁 <strong>4. Lineups revealed</strong><br />Both lines reveal automatically.</p></div><div className="need-help"><h3>Need Help?</h3><button className="btn ghost full">View Rules</button><button className="btn ghost full">Contact Admin</button></div></aside>
      </div>

      <div className="captain-action-row"><div className="share-card"><h3>Share After Submission</h3><div>💬<p><strong>Share via WhatsApp</strong><small>Notify your opponent once you submit.</small></p><a className="btn small" href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noreferrer">Preview Message</a></div></div><div className="refresh-card"><h3>Refresh Status</h3><div>↻<p><span>Last Refreshed</span><strong>{formatTime(lastRefreshed)}</strong></p><button className="btn small ghost" type="button" onClick={() => setLastRefreshed(new Date())}>Refresh Now</button></div></div></div>

      <section className="completed-premium" id="completed"><div className="section-head"><h2>Completed Matches</h2><a href="/schedule">View All</a></div><div className="completed-card-grid">{completedFixtures.slice(0, 3).map((item, idx) => { const ft = fixtureTeams(item, teams); const other = ft.team1?.id === captainTeam.id ? ft.team2 : ft.team1; return <div className="completed-mini-card" key={item.id}><span>{idx === 2 ? 'Playoffs' : `Round ${item.round || idx + 1}`}</span><div><TeamShield team={captainTeam} /><b>VS</b><TeamShield team={other} /></div><p>{captainTeam.name} <strong>{idx === 1 ? '5 - 4' : idx === 2 ? '6 - 2' : '6 - 3'}</strong> {other?.name || 'Opponent'}</p><em>{captainTeam.name} Won</em></div>; })}</div></section>
    </main>
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
  const capacityRows = useMemo(() => captainTeam ? buildCaptainCapacityRows(captainTeam, teams, matches, eligibilityRules) : [], [captainTeam, teams, matches, eligibilityRules]);

  if (captainTeam) {
    return (
      <PremiumCaptainDashboard
        captainTeam={captainTeam}
        upcomingFixtures={upcomingCaptainFixtures}
        completedFixtures={completedCaptainFixtures}
        teams={teams}
        capacityRows={capacityRows}
      />
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
