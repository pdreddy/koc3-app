import React, { useMemo } from 'react';
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

export default function Home({ teams, schedule, matches = [], eligibilityRules = DEFAULT_ELIGIBILITY_RULES, config }) {
  const { session } = useAuth();
  const club = config?.club || {};
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
        <div className="rl-grid">
          <ScheduleMiniList
            title="Upcoming Fixtures"
            description="Only unplayed fixtures for your team are shown here."
            fixtures={upcomingCaptainFixtures}
            teams={teams}
            emptyText="No upcoming fixtures found for your team."
            testid="captain-upcoming-schedule-card"
            showStatus
          />
          <ScheduleMiniList
            title="Completed Fixtures"
            description="Completed fixtures for your team."
            fixtures={completedCaptainFixtures}
            teams={teams}
            emptyText="No completed fixtures yet."
            testid="captain-completed-schedule-card"
            showStatus
          />
        </div>
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
      {club.bannerUrl && (
        <img
          src={club.bannerUrl}
          alt={`${club.seasonName || 'Season'} banner`}
          data-testid="home-season-banner"
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginBottom: '1rem' }}
        />
      )}
      <div className="page-title">
        <h1>{club.seasonName || 'KOC3 / PPRC Tennis'}</h1>
        <p>{club.publicViewNote || 'Public landing page: all league schedules are visible without login.'}</p>
      </div>
      <section className="card" data-testid="home-register-cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>🎾 Player Registration</h2>
          <p className="hint" style={{ margin: '.25rem 0 0' }}>New here? Register for the season. Already a player? Set up your password, email and phone.</p>
        </div>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          <Link className="btn" to="/register" data-testid="home-register-link">Register</Link>
          <Link className="btn ghost" to="/register" data-testid="home-profile-link">My Profile</Link>
        </div>
      </section>
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
