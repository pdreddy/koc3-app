import React, { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, PATHS, ensureAuth } from '../firebase';

function computeStandings(matches) {
  const stats = {};
  matches.forEach(m => {
    [m.t1, m.t2].forEach(t => {
      if (!t || stats[t]) return;
      stats[t] = { team: t, matches: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, points: 0 };
    });
    if (!stats[m.t1] || !stats[m.t2]) return;
    stats[m.t1].matches++; stats[m.t2].matches++;
    stats[m.t1].gamesFor += Number(m.g1) || 0; stats[m.t1].gamesAgainst += Number(m.g2) || 0;
    stats[m.t2].gamesFor += Number(m.g2) || 0; stats[m.t2].gamesAgainst += Number(m.g1) || 0;
    stats[m.t1].setsFor += Number(m.s1) || 0; stats[m.t1].setsAgainst += Number(m.s2) || 0;
    stats[m.t2].setsFor += Number(m.s2) || 0; stats[m.t2].setsAgainst += Number(m.s1) || 0;
    if (m.win === m.t1) { stats[m.t1].wins++; stats[m.t2].losses++; stats[m.t1].points++; }
    else if (m.win === m.t2) { stats[m.t2].wins++; stats[m.t1].losses++; stats[m.t2].points++; }
  });
  return Object.values(stats).map(s => ({
    ...s,
    setDiff: s.setsFor - s.setsAgainst,
    gameDiff: s.gamesFor - s.gamesAgainst
  })).sort((a, b) =>
    (b.points - a.points) || (b.setDiff - a.setDiff) || (b.setsFor - a.setsFor) ||
    (b.gameDiff - a.gameDiff) || (b.gamesFor - a.gamesFor) || a.team.localeCompare(b.team)
  );
}

export default function Season2() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('standings');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    ensureAuth();
    const unsub = onValue(ref(db, PATHS.season2), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, m]) => ({ id, ...m }));
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setMatches(list);
      setLoading(false);
    }, (err) => {
      setError('Could not load Season 2: ' + err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const standings = useMemo(() => computeStandings(matches), [matches]);

  return (
    <main className="container">
      <div className="page-title">
        <h1>🏆 Season 2 Archive</h1>
        <p>{loading ? 'Loading…' : `${matches.length} matches · ${standings.length} teams`}</p>
      </div>

      {error && <div className="error-box" data-testid="season2-error">{error}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')} data-testid="season2-tab-standings">Final Standings</button>
        <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')} data-testid="season2-tab-matches">Match History</button>
      </div>

      {tab === 'standings' && (
        <div className="card">
          <h2>Final Standings</h2>
          <div className="table-wrap">
            <table className="std" data-testid="season2-standings-table">
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
                {standings.length === 0 && <tr><td colSpan="8" className="center muted">{loading ? 'Loading…' : 'No data'}</td></tr>}
                {standings.map((r, i) => (
                  <tr key={r.team} className={i === 0 ? 'q' : ''} data-testid={`season2-row-${i}`}>
                    <td className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                    <td><strong>{r.team}</strong></td>
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
        </div>
      )}

      {tab === 'matches' && (
        <>
          {matches.length === 0 && !loading && (
            <div className="card center muted" data-testid="season2-empty">No Season 2 matches found.</div>
          )}
          {matches.map(m => (
            <div className="match-hist" key={m.id} data-testid={`season2-match-${m.id}`}>
              <div className="teams">{m.t1} vs {m.t2}</div>
              <div className="meta">
                <div>
                  {m.win && <span className="tag win">{m.win} won</span>}
                  <span style={{ marginLeft: '.4rem' }}>{m.g1}–{m.g2} games · {m.s1}–{m.s2} sets</span>
                </div>
                <small>{m.ts ? new Date(m.ts).toLocaleDateString() : ''}</small>
              </div>
              {Array.isArray(m.lines) && m.lines.length > 0 && (
                <>
                  <button
                    className="btn small ghost"
                    style={{ marginTop: '.5rem' }}
                    onClick={() => setOpenId(openId === m.id ? null : m.id)}
                    data-testid={`season2-match-toggle-${m.id}`}
                  >
                    {openId === m.id ? 'Hide details' : 'Show details'}
                  </button>
                  {openId === m.id && (
                    <div className="lines">
                      {m.lines.map((l, i) => {
                        const scores = (l.sets || []).map(s => {
                          let str = `${s.team1}-${s.team2}`;
                          if (s.tieBreak) str += `(${s.tieBreak.team1}-${s.tieBreak.team2})`;
                          return str;
                        }).join(', ');
                        return (
                          <div className="ln" key={i}>
                            <strong>{l.label}:</strong> {l.players?.team1?.join('/')} vs {l.players?.team2?.join('/')} — {scores} ({l.g1}-{l.g2})
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
