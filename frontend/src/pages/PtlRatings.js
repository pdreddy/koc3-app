import React, { useMemo, useState } from 'react';
import { buildPprcRatings } from '../utils/pprcRating';
import { UTR_RATINGS } from '../data/utrRatings';

function formatRating(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}




function RatingRows({ players, startRank = 1, highlightQualifiers = true }) {
  return players.map((player, idx) => {
    const rank = startRank + idx;
    const deltaClass = player.ratingDelta > 0 ? 'win' : player.ratingDelta < 0 ? 'lose' : 'tie';
    return (
      <tr key={`${player.teamAbbr}-${player.name}`} className={highlightQualifiers && rank <= 8 && player.courts > 0 ? 'q' : ''} data-testid={`ptl-player-${player.name}`}>
        <td className="rank">{rank}</td>
        <td>
          <strong>{player.name}</strong>
          <div className="muted" style={{ fontSize: '.72rem' }}>{player.seasonTeamSummary || 'No season/team data yet'}</div>
          {!player.hasUtrLookup && <div className="muted" style={{ fontSize: '.72rem' }}>Needs UTR name mapping</div>}
        </td>
        <td>{formatRating(player.currentSinglesUtr)}</td>
        <td><strong className="ptl-rating-value">{formatRating(player.pprcSinglesRating)}</strong></td>
        <td>{formatRating(player.currentDoublesUtr)}</td>
        <td><strong className="ptl-rating-value">{formatRating(player.pprcDoublesRating)}</strong></td>
        <td><span className={`tag ${deltaClass}`}>{player.singlesRatingDelta > 0 ? '+' : ''}{formatRating(player.singlesRatingDelta)}/{player.doublesRatingDelta > 0 ? '+' : ''}{formatRating(player.doublesRatingDelta)}</span></td>
        <td>{player.wins}-{player.losses}</td>
        <td>{player.winPct}%</td>
        <td>{player.singles}/{player.doubles}</td>
        <td>{player.gameDiff > 0 ? `+${player.gameDiff}` : player.gameDiff}</td>
      </tr>
    );
  });
}

function RatingTable({ players, emptyText, startRank = 1, highlightQualifiers = true, testid = 'ptl-ratings-table' }) {
  return (
    <div className="table-wrap">
      <table className="std ptl-table" data-testid={testid}>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>UTR S</th>
            <th>PPRC S</th>
            <th>UTR D</th>
            <th>PPRC D</th>
            <th>Δ S/D</th>
            <th>W-L</th>
            <th>Win%</th>
            <th>S/D</th>
            <th>G±</th>
          </tr>
        </thead>
        <tbody>
          {players.length === 0 && <tr><td colSpan="11" className="center muted">{emptyText}</td></tr>}
          <RatingRows players={players} startRank={startRank} highlightQualifiers={highlightQualifiers} />
        </tbody>
      </table>
    </div>
  );
}


export default function PtlRatings({ teams, matches, previousMatches = [], ratingLookup = {} }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('ratings');
  const lookupRows = useMemo(() => {
    const entries = Object.entries(ratingLookup || {});
    const rows = entries.map(([id, row]) => ({ _id: id, ...(row || {}) }));
    return rows.length > 0 ? rows : UTR_RATINGS;
  }, [ratingLookup]);
  const ratingMatches = useMemo(() => [
    ...(previousMatches || []).map(match => ({ ...match, source: match.source || 'Season 2' })),
    ...(matches || []).map(match => ({ ...match, source: match.source || 'KOC3' }))
  ], [matches, previousMatches]);
  const ratings = useMemo(() => buildPprcRatings(teams, ratingMatches, lookupRows), [teams, ratingMatches, lookupRows]);
  const filtered = ratings.filter(player =>
    !q || `${player.name} ${player.team} ${player.teamAbbr} ${player.seasonTeamSummary}`.toLowerCase().includes(q.toLowerCase())
  );

  const mappedPlayers = filtered.filter(player => player.hasUtrLookup);
  const unmappedPlayers = filtered.filter(player => !player.hasUtrLookup);
  const activeCount = ratings.filter(player => player.courts > 0).length;
  const unmappedCount = ratings.filter(player => !player.hasUtrLookup).length;
  const leader = ratings.find(player => player.courts > 0 && player.hasUtrLookup) || ratings.find(player => player.courts > 0);



  return (
    <main className="container">
      <div className="page-title ptl-hero">
        <div>
          <h1>PPRC Rating</h1>
          <p>UTR-style KOC performance rating using clean KOC3 and Season 2 history.</p>
        </div>
        <div className="ptl-hero-stat">
          <span>Leader</span>
          <strong>{leader ? leader.name : '—'}</strong>
          <small>{leader ? formatRating(leader.pprcRating) : 'No scores yet'}</small>
        </div>
      </div>

      <div className="ptl-summary">
        <div className="card ptl-info-card">
          <span className="ptl-kicker">Algorithm</span>
          <h2>How PPRC works</h2>
          <p>
            PPRC combines all loaded seasons for the same player name. It starts singles and doubles separately from the UTR table when available, otherwise from 3.50.
            Each court compares the player rating to the opponent or opponent-pair average, applies a small
            game-margin adjustment, caps each court movement, then averages PPRC S and PPRC D into the final rating.
            Previous season matches are cleaned from /koc_s2/matches before rating, and aliases are not used.
          </p>
        </div>
        <div className="card ptl-metric">
          <span>Rated players</span>
          <strong>{activeCount}</strong>
          <small>{ratingMatches.length} matches · {unmappedCount} need mapping</small>
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

      <div className="tabs">
        <button className={`tab ${tab === 'ratings' ? 'active' : ''}`} onClick={() => setTab('ratings')} data-testid="ptl-tab-ratings">PPRC Ratings</button>
        <button className={`tab ${tab === 'lookup' ? 'active' : ''}`} onClick={() => setTab('lookup')} data-testid="ptl-tab-lookup">UTR Lookup</button>
      </div>

      {tab === 'lookup' && (
        <div className="card">
          <h2>Stored Player Rating Lookup</h2>
          <p className="hint">This table is seeded into Firebase at {`/${'koc_s3/playerRatings'}`} and used as the PPRC lookup.</p>
          <div className="table-wrap">
            <table className="std ptl-table" data-testid="ptl-lookup-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Singles UTR</th>
                  <th>Status</th>
                  <th>Doubles UTR</th>
                  <th>Doubles Status</th>
                </tr>
              </thead>
              <tbody>
                {lookupRows.map(row => (
                  <tr key={row.fullName}>
                    <td><strong>{row.fullName}</strong></td>
                    <td>{formatRating(row.singlesUtr)}</td>
                    <td>{row.singlesStatus || '—'}</td>
                    <td>{formatRating(row.doublesUtr)}</td>
                    <td>{row.verifiedDoublesStatus || row.doublesStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {tab === 'ratings' && (
        <>
          <div className="card">
            <h2>Mapped PPRC Ratings <span className="muted" style={{ fontWeight: 500, fontSize: '.85rem' }}>· matched to UTR names</span></h2>
            <RatingTable players={mappedPlayers} emptyText="No mapped players found" />
            <p className="hint">PPRC = Prosper Performance Rating for Court results. UTR S/D come from the stored lookup table; PPRC S/D are KOC-only singles and doubles performance ratings.</p>
          </div>

          {unmappedPlayers.length > 0 && (
            <div className="card ptl-unmapped-card" data-testid="ptl-unmapped-card">
              <h2>Needs Name Mapping <span className="muted" style={{ fontWeight: 500, fontSize: '.85rem' }}>· not found in UTR lookup</span></h2>
              <p className="hint">These players are kept below the main mapped group because their current or legacy match name did not resolve to a stored UTR player. Clean the player lookup keys in Firebase to move them into the mapped table.</p>
              <RatingTable
                players={unmappedPlayers}
                emptyText="All players are mapped"
                startRank={mappedPlayers.length + 1}
                highlightQualifiers={false}
                testid="ptl-unmapped-table"
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
