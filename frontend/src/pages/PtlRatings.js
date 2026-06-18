import React, { useMemo, useState } from 'react';
import { buildPtlRatings } from '../utils/ptlRating';

function formatRating(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}

export default function PtlRatings({ teams, matches, previousMatches = [] }) {
  const [q, setQ] = useState('');
  const ratingMatches = useMemo(() => [
    ...(previousMatches || []).map(match => ({ ...match, source: match.source || 'KOC2DBPONEW' })),
    ...(matches || []).map(match => ({ ...match, source: match.source || 'KOC3' }))
  ], [matches, previousMatches]);
  const ratings = useMemo(() => buildPtlRatings(teams, ratingMatches), [teams, ratingMatches]);
  const filtered = ratings.filter(player =>
    !q || `${player.name} ${player.team} ${player.teamAbbr}`.toLowerCase().includes(q.toLowerCase())
  );

  const activeCount = ratings.filter(player => player.courts > 0).length;
  const leader = ratings.find(player => player.courts > 0);

  return (
    <main className="container">
      <div className="page-title ptl-hero">
        <div>
          <h1>PTL Rating</h1>
          <p>UTR-style KOC performance rating using KOC3 plus pulled KOC2DBPONEW history.</p>
        </div>
        <div className="ptl-hero-stat">
          <span>Leader</span>
          <strong>{leader ? leader.name : '—'}</strong>
          <small>{leader ? formatRating(leader.ptlRating) : 'No scores yet'}</small>
        </div>
      </div>

      <div className="ptl-summary">
        <div className="card ptl-info-card">
          <span className="ptl-kicker">Algorithm</span>
          <h2>How PTL works</h2>
          <p>
            PTL starts singles and doubles separately from the UTR table when available, otherwise from 3.50.
            Singles courts update only the singles PTL; doubles courts update only the doubles PTL using
            the average rating of the opposing pair. Previous season matches are pulled from /KOC2DBPONEW.
          </p>
        </div>
        <div className="card ptl-metric">
          <span>Rated players</span>
          <strong>{activeCount}</strong>
          <small>{ratingMatches.length} current + previous matches</small>
        </div>
      </div>

      <input
        className="input"
        placeholder="🔍 Search player or team..."
        value={q}
        onChange={e => setQ(e.target.value)}
        data-testid="ptl-search"
        style={{ marginBottom: '.7rem' }}
      />

      <div className="card">
        <div className="table-wrap">
          <table className="std ptl-table" data-testid="ptl-ratings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>UTR S</th>
                <th>PTL S</th>
                <th>UTR D</th>
                <th>PTL D</th>
                <th>Δ S/D</th>
                <th>W-L</th>
                <th>Win%</th>
                <th>S/D</th>
                <th>G±</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan="12" className="center muted">No players found</td></tr>}
              {filtered.map((player, idx) => {
                const deltaClass = player.ratingDelta > 0 ? 'win' : player.ratingDelta < 0 ? 'lose' : 'tie';
                return (
                  <tr key={`${player.teamAbbr}-${player.name}`} className={idx < 8 && player.courts > 0 ? 'q' : ''} data-testid={`ptl-player-${player.name}`}>
                    <td className="rank">{idx + 1}</td>
                    <td><strong>{player.name}</strong></td>
                    <td><span className="tag">{player.teamAbbr}</span></td>
                    <td>{formatRating(player.currentSinglesUtr)}</td>
                    <td><strong className="ptl-rating-value">{formatRating(player.ptlSinglesRating)}</strong></td>
                    <td>{formatRating(player.currentDoublesUtr)}</td>
                    <td><strong className="ptl-rating-value">{formatRating(player.ptlDoublesRating)}</strong></td>
                    <td><span className={`tag ${deltaClass}`}>{player.singlesRatingDelta > 0 ? '+' : ''}{formatRating(player.singlesRatingDelta)}/{player.doublesRatingDelta > 0 ? '+' : ''}{formatRating(player.doublesRatingDelta)}</span></td>
                    <td>{player.wins}-{player.losses}</td>
                    <td>{player.winPct}%</td>
                    <td>{player.singles}/{player.doubles}</td>
                    <td>{player.gameDiff > 0 ? `+${player.gameDiff}` : player.gameDiff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">PTL = Prosper Tennis League rating. UTR S/D come from the provided lookup table; PTL S/D are KOC-only singles and doubles performance ratings.</p>
      </div>
    </main>
  );
}
