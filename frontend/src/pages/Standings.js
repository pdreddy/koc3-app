import React from 'react';
import { resolveMatchTeams, matchWinnerId } from '../utils/matchTeams';
import { isApprovedMatch } from '../utils/matchStatus';
import { normalizeConfig, TIEBREAK_KEYS } from '../data/seasonConfig';

function statsForGroup(teamsInGroup, matches, allTeams, scoring) {
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
    if (winId === team1.id) { stats[team1.id].wins++; stats[team2.id].losses++; stats[team1.id].points += scoring.pointsWin; stats[team2.id].points += scoring.pointsLoss; }
    else if (winId === team2.id) { stats[team2.id].wins++; stats[team1.id].losses++; stats[team2.id].points += scoring.pointsWin; stats[team1.id].points += scoring.pointsLoss; }
    headToHead[`${team1.id}:${team2.id}`] = (headToHead[`${team1.id}:${team2.id}`] || 0) + (winId === team1.id ? 1 : 0);
    headToHead[`${team2.id}:${team1.id}`] = (headToHead[`${team2.id}:${team1.id}`] || 0) + (winId === team2.id ? 1 : 0);
  }

  // Configurable tiebreak hierarchy. Each comparator returns a negative number
  // when `b` should rank ahead of `a` (descending), matching the previous
  // Points → Sets → Singles → H2H → Games behavior by default.
  const comparators = {
    points: (a, b) => b.points - a.points,
    sets: (a, b) => b.setsFor - a.setsFor,
    singlesWins: (a, b) => b.singlesWins - a.singlesWins,
    headToHead: (a, b) => (headToHead[`${b.id}:${a.id}`] || 0) - (headToHead[`${a.id}:${b.id}`] || 0),
    games: (a, b) => (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst)
  };
  const order = scoring.tiebreakOrder?.length ? scoring.tiebreakOrder : ['points', 'sets', 'singlesWins', 'headToHead', 'games'];

  return Object.values(stats).map(s => ({
    ...s,
    setDiff: s.setsFor - s.setsAgainst,
    gameDiff: s.gamesFor - s.gamesAgainst
  })).sort((a, b) => {
    for (const key of order) {
      const cmp = comparators[key];
      if (!cmp) continue;
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return a.team.localeCompare(b.team);
  });
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

export default function Standings({ teams, matches, config }) {
  const cfg = normalizeConfig(config);
  const scoring = cfg.scoring;
  const qualifyTop = cfg.playoffs.qualifyPerGroup;
  const list = Object.values(teams || {});

  // Derive the set of groups from config, but fall back to whatever groups the
  // team records actually use so existing data always renders.
  const configGroupIds = cfg.format.groups.map(g => g.id);
  const dataGroupIds = Array.from(new Set(list.map(t => t.group || 'A')));
  const groupIds = configGroupIds.length ? configGroupIds : dataGroupIds;
  // Include any data groups not present in config (defensive).
  dataGroupIds.forEach(id => { if (!groupIds.includes(id)) groupIds.push(id); });

  const groups = groupIds.map(id => {
    const rows = list
      .filter(t => (t.group || 'A') === id)
      .sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
    return { id, rows: statsForGroup(rows, matches, teams, scoring) };
  });

  const tiebreakSummary = (scoring.tiebreakOrder || []).map(key => TIEBREAK_KEYS[key] || key).join(' → ');
  const subtitle = cfg.format.type === 'groups_playoffs'
    ? `${groups.length} group${groups.length === 1 ? '' : 's'} · Top ${qualifyTop} from each group qualify for the playoffs`
    : `${list.length} teams · Top ${qualifyTop} qualify`;

  return (
    <main className="container">
      <div className="page-title">
        <h1>Standings</h1>
        <p>{subtitle}</p>
      </div>
      <div className="groups-grid">
        {groups.map(g => <GroupTable key={g.id} label={g.id} rows={g.rows} qualifyTop={qualifyTop} />)}
      </div>
      {tiebreakSummary && <p className="hint center">Sort: {tiebreakSummary}</p>}
    </main>
  );
}
