import React from 'react';

export default function Standings({ teams, matches }) {
  const teamMap = {};
  Object.values(teams || {}).forEach(t => {
    teamMap[t.name] = t;
  });

  const stats = {};
  Object.values(teams || {}).forEach(t => {
    stats[t.name] = {
      team: t.name,
      abbr: t.abbreviation,
      matches: 0, wins: 0, losses: 0,
      setsFor: 0, setsAgainst: 0,
      gamesFor: 0, gamesAgainst: 0,
      points: 0
    };
  });

  for (const m of matches || []) {
    if (!stats[m.t1] || !stats[m.t2]) continue;
    stats[m.t1].matches++; stats[m.t2].matches++;
    stats[m.t1].gamesFor += Number(m.g1) || 0; stats[m.t1].gamesAgainst += Number(m.g2) || 0;
    stats[m.t2].gamesFor += Number(m.g2) || 0; stats[m.t2].gamesAgainst += Number(m.g1) || 0;
    stats[m.t1].setsFor += Number(m.s1) || 0; stats[m.t1].setsAgainst += Number(m.s2) || 0;
    stats[m.t2].setsFor += Number(m.s2) || 0; stats[m.t2].setsAgainst += Number(m.s1) || 0;
    if (m.win === m.t1) { stats[m.t1].wins++; stats[m.t2].losses++; stats[m.t1].points++; }
    else if (m.win === m.t2) { stats[m.t2].wins++; stats[m.t1].losses++; stats[m.t2].points++; }
  }

  const rows = Object.values(stats).map(s => ({
    ...s,
    setDiff: s.setsFor - s.setsAgainst,
    gameDiff: s.gamesFor - s.gamesAgainst
  })).sort((a, b) =>
    (b.points - a.points) || (b.setDiff - a.setDiff) || (b.setsFor - a.setsFor) ||
    (b.gameDiff - a.gameDiff) || (b.gamesFor - a.gamesFor) || a.team.localeCompare(b.team)
  );

  return (
    <main className="container">
      <div className="page-title">
        <h1>Standings</h1>
        <p>Live rankings • Top 4 qualify</p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="std" data-testid="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>M</th>
                <th>W</th>
                <th>L</th>
                <th>S±</th>
                <th>G±</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="8" className="center muted">No teams configured</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.team} className={i < 4 ? 'q' : ''} data-testid={`standings-row-${r.abbr}`}>
                  <td className="rank">{i + 1}</td>
                  <td><strong>{r.abbr}</strong></td>
                  <td>{r.matches}</td>
                  <td>{r.wins}</td>
                  <td>{r.losses}</td>
                  <td>{r.setDiff > 0 ? `+${r.setDiff}` : r.setDiff}</td>
                  <td>{r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}</td>
                  <td className="pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Sort: Pts → Set Diff → Sets Won → Game Diff → Games Won</p>
      </div>
    </main>
  );
}
