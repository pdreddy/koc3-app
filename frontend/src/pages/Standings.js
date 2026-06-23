import React from 'react';
import { resolveMatchTeams, matchWinnerId } from '../utils/matchTeams';
import { isApprovedMatch } from '../utils/matchStatus';

function statsForGroup(teamsInGroup, matches, allTeams) {
  const groupIds = new Set(teamsInGroup.map(t => t.id));
  const stats = {};
  teamsInGroup.forEach(t => {
    stats[t.id] = {
      id: t.id, team: t.name, abbr: t.abbreviation,
      matches: 0, wins: 0, losses: 0,
      setsFor: 0, setsAgainst: 0,
      gamesFor: 0, gamesAgainst: 0, points: 0, singlesWins: 0
    };
  });
  const headToHead = {};
  for (const m of matches || []) {
    if (!isApprovedMatch(m)) continue;
    const { team1, team2 } = resolveMatchTeams(m, allTeams);
    if (!team1 || !team2) continue;
    if (!groupIds.has(team1.id) || !groupIds.has(team2.id)) continue;
    const winId = matchWinnerId(m, allTeams);
    stats[team1.id].matches++; stats[team2.id].matches++;
    stats[team1.id].gamesFor += Number(m.g1) || 0; stats[team1.id].gamesAgainst += Number(m.g2) || 0;
    stats[team2.id].gamesFor += Number(m.g2) || 0; stats[team2.id].gamesAgainst += Number(m.g1) || 0;
    stats[team1.id].setsFor += Number(m.s1) || 0; stats[team1.id].setsAgainst += Number(m.s2) || 0;
    stats[team2.id].setsFor += Number(m.s2) || 0; stats[team2.id].setsAgainst += Number(m.s1) || 0;
    (m.lines || []).filter(l => l.type === 'singles').forEach(l => {
      if ((Number(l.g1) || 0) > (Number(l.g2) || 0)) stats[team1.id].singlesWins++;
      if ((Number(l.g2) || 0) > (Number(l.g1) || 0)) stats[team2.id].singlesWins++;
    });
    if (winId === team1.id) { stats[team1.id].wins++; stats[team2.id].losses++; stats[team1.id].points++; }
    else if (winId === team2.id) { stats[team2.id].wins++; stats[team1.id].losses++; stats[team2.id].points++; }
    headToHead[`${team1.id}:${team2.id}`] = (headToHead[`${team1.id}:${team2.id}`] || 0) + (winId === team1.id ? 1 : 0);
    headToHead[`${team2.id}:${team1.id}`] = (headToHead[`${team2.id}:${team1.id}`] || 0) + (winId === team2.id ? 1 : 0);
  }
  return Object.values(stats).map(s => ({
    ...s,
    setDiff: s.setsFor - s.setsAgainst,
    gameDiff: s.gamesFor - s.gamesAgainst
  })).sort((a, b) =>
    (b.points - a.points) || (b.setsFor - a.setsFor) || (b.singlesWins - a.singlesWins) ||
    ((headToHead[`${b.id}:${a.id}`] || 0) - (headToHead[`${a.id}:${b.id}`] || 0)) ||
    (b.gameDiff - a.gameDiff) || a.team.localeCompare(b.team)
  );
}

function GroupTable({ label, rows, qualifyTop }) {
  return (
    <div className="card" data-testid={`standings-group-${label}`}>
      <h2>Group {label} <span className="muted" style={{ fontWeight: 500, fontSize: '.85rem' }}>· {rows.length} teams</span></h2>
      <div className="table-wrap">
        <table className="std" data-testid={`standings-table-${label}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>M</th>
              <th>W</th>
              <th>L</th>
              <th>SW</th>
              <th>SL</th>
              <th>SingW</th>
              <th>G±</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="10" className="center muted">No teams in this group</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} className={i < qualifyTop ? 'q' : ''} data-testid={`standings-${label}-row-${r.abbr}`}>
                <td className="rank">{i + 1}</td>
                <td><strong>{r.abbr}</strong></td>
                <td>{r.matches}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.setsFor}</td>
                <td>{r.setsAgainst}</td>
                <td>{r.singlesWins}</td>
                <td>{r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}</td>
                <td className="pts">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Standings({ teams, matches }) {
  const list = Object.values(teams || {});
  const groupA = list.filter(t => (t.group || 'A') === 'A').sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const groupB = list.filter(t => t.group === 'B').sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  const rowsA = statsForGroup(groupA, matches, teams);
  const rowsB = statsForGroup(groupB, matches, teams);

  return (
    <main className="container">
      <div className="page-title">
        <h1>Standings</h1>
        <p>Two groups of 8 · Top 2 from each group qualify for semifinals</p>
      </div>
      <div className="groups-grid">
        <GroupTable label="A" rows={rowsA} qualifyTop={2} />
        <GroupTable label="B" rows={rowsB} qualifyTop={2} />
      </div>
      <p className="hint center">Sort: Team Points → Sets Won → Singles Wins → Head-to-Head → Games Difference</p>
    </main>
  );
}
