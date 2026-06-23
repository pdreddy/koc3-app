import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../utils/roles';
import { approvedMatches } from '../utils/matchStatus';
import { resolveMatchTeams } from '../utils/matchTeams';
import { DEFAULT_ELIGIBILITY_RULES, normalizeEligibilityRules } from '../utils/eligibilityRules';

function playerKey(name) {
  return String(name || '').trim().toLowerCase();
}

function buildCaptainCapacityRows(team, teams, matches, eligibilityRules) {
  const rules = normalizeEligibilityRules(eligibilityRules);
  const rows = new Map((team?.players || []).map(player => [playerKey(player.name), {
    name: player.name, singlesDays: 0, doublesDays: 0, totalMatchDays: 0, partnerCounts: {}
  }]));

  approvedMatches(matches).forEach(match => {
    const { team1, team2 } = resolveMatchTeams(match, teams);
    const side = team1?.id === team?.id ? 'team1' : (team2?.id === team?.id ? 'team2' : null);
    if (!side) return;
    const dayPlayers = new Map();
    const dayPairs = new Set();
    (match.lines || []).forEach(line => {
      const names = line.players?.[side] || [];
      names.forEach(name => {
        const key = playerKey(name);
        const current = dayPlayers.get(key) || { name, singles: false, doubles: false };
        if (line.type === 'singles') current.singles = true;
        if (line.type === 'doubles') current.doubles = true;
        dayPlayers.set(key, current);
      });
      if (line.type === 'doubles' && names.length === 2) dayPairs.add(names.map(playerKey).sort().join('|'));
    });
    dayPlayers.forEach(day => {
      const row = rows.get(playerKey(day.name));
      if (!row) return;
      if (day.singles) row.singlesDays += 1;
      if (day.doubles) row.doublesDays += 1;
      row.totalMatchDays = row.singlesDays + row.doublesDays;
    });
    dayPairs.forEach(pairKeyValue => {
      pairKeyValue.split('|').forEach(key => {
        const row = rows.get(key);
        if (row) row.partnerCounts[pairKeyValue] = (row.partnerCounts[pairKeyValue] || 0) + 1;
      });
    });
  });

  return Array.from(rows.values()).map(row => {
    const maxPartner = Math.max(0, ...Object.values(row.partnerCounts || {}));
    const warnings = [];
    if (row.singlesDays >= rules.maxSinglesDays) warnings.push('Singles cap reached');
    else if (row.singlesDays === rules.maxSinglesDays - 1) warnings.push('1 singles day left');
    if (row.totalMatchDays >= rules.maxTotalMatchDays) warnings.push('Total cap reached');
    else if (row.totalMatchDays === rules.maxTotalMatchDays - 1) warnings.push('1 match day left');
    if (maxPartner >= rules.maxPartnerDays) warnings.push('Partner cap reached');
    else if (maxPartner === rules.maxPartnerDays - 1) warnings.push('1 partner day left');
    return { ...row, maxPartner, warnings };
  });
}

function CaptainCapacityCard({ team, teams, matches, eligibilityRules }) {
  const rules = useMemo(() => normalizeEligibilityRules(eligibilityRules), [eligibilityRules]);
  const rows = useMemo(() => buildCaptainCapacityRows(team, teams, matches, eligibilityRules), [team, teams, matches, eligibilityRules]);
  if (!team) return null;
  return (
    <div className="card captain-capacity-card" data-testid="captain-capacity-card">
      <h2>Captain Capacity Watch</h2>
      <p className="hint">Singles cap is {rules.maxSinglesDays} days. Review capacity before setting lines.</p>
      <div className="table-wrap">
        <table className="std" data-testid="captain-capacity-table">
          <thead><tr><th>Player</th><th>Singles</th><th>Total</th><th>Partner</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name} className={row.warnings.length ? 'q' : ''}>
                <td><strong>{row.name}</strong></td>
                <td>{row.singlesDays}/{rules.maxSinglesDays}</td>
                <td>{row.totalMatchDays}/{rules.maxTotalMatchDays}</td>
                <td>{row.maxPartner}/{rules.maxPartnerDays}</td>
                <td>{row.warnings.length ? row.warnings.join(', ') : 'Available'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamCard({ t, isOpen, onToggle }) {
  const gradClass = `team-grad-${t.gradient || 1}`;
  return (
    <div className="team-card" data-testid={`team-card-${t.abbreviation}`}>
      <div
        className={`team-header ${gradClass}`}
        onClick={onToggle}
        data-testid={`team-toggle-${t.abbreviation}`}
      >
        <h2>{t.name}</h2>
        <span className="abbr">{t.abbreviation}</span>
      </div>
      {isOpen && (
        <div className="team-body">
          {(t.players || []).map((p, i) => {
            const utr = p.actualUtr || p.utr || '';
            return (
              <div key={i} className={`player-row ${p.isCaptain ? 'captain' : ''}`} data-testid={`team-${t.abbreviation}-player-${i}`}>
                <span className="player-badge">{p.isCaptain ? '🏆' : '🎾'}</span>
                <span className="player-name">{p.name}</span>
                {utr && <span className="player-utr">UTR {utr}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Teams({ teams, loaded, matches = [], eligibilityRules = DEFAULT_ELIGIBILITY_RULES }) {
  const [open, setOpen] = useState({});
  const { session } = useAuth();
  const list = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const groupA = list.filter(t => (t.group || 'A') === 'A');
  const groupB = list.filter(t => t.group === 'B');
  const captainTeam = session.role === ROLES.CAPTAIN ? teams[session.teamId] : null;

  if (!loaded) {
    return (
      <main className="container">
        <div className="page-title"><h1>Tournament Teams</h1><p>Loading...</p></div>
      </main>
    );
  }

  const toggle = (id) => setOpen(o => ({ ...o, [id]: o[id] === undefined ? false : !o[id] }));

  const renderColumn = (label, teamsList, testid) => (
    <div data-testid={testid}>
      <h2 className="group-col-title" data-testid={`teams-group-${label.toLowerCase()}-header`}>
        {label === 'A' ? '🅰️' : '🅱️'} Group {label}
      </h2>
      <div className="teams-list">
        {teamsList.map(t => (
          <TeamCard
            key={t.id}
            t={t}
            isOpen={open[t.id] === undefined ? true : open[t.id]}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <main className="container">
      <div className="page-title">
        <h1>Tournament Teams</h1>
        <p>{list.length} teams · 2 groups of 8 · Tap a card to toggle roster</p>
      </div>

      {captainTeam && <CaptainCapacityCard team={captainTeam} teams={teams} matches={matches} eligibilityRules={eligibilityRules} />}

      <div className="groups-grid">
        {renderColumn('A', groupA, 'teams-list-a')}
        {renderColumn('B', groupB, 'teams-list-b')}
      </div>
    </main>
  );
}
