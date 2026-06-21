import React, { useMemo, useState } from 'react';
import { ref, update } from 'firebase/database';
import { buildPtlRatings } from '../utils/ptlRating';
import { UTR_RATINGS, matchUtrRating, normalizeNameKey, suggestUtrMatches } from '../data/utrRatings';
import { db, PATHS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

function formatRating(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}



function ratingRowId(row) {
  return row?._id || String(row?.fullName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function uniqueValues(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function NameMappingRow({ sourceName, lookupRows, onSaved, canSave }) {
  const suggestions = useMemo(() => suggestUtrMatches(sourceName, lookupRows, 5), [sourceName, lookupRows]);
  const initialTarget = suggestions[0]?.row.fullName || lookupRows[0]?.fullName || '';
  const [targetName, setTargetName] = useState(initialTarget);
  const [status, setStatus] = useState('');
  const targetRow = lookupRows.find(row => row.fullName === targetName) || suggestions[0]?.row;

  async function saveMapping() {
    if (!sourceName || !targetRow) return;
    const id = ratingRowId(targetRow);
    if (!id) {
      setStatus('Unable to save: selected player has no rating id.');
      return;
    }
    const aliases = uniqueValues([...(targetRow.aliases || []), sourceName]);
    const keys = uniqueValues([...(targetRow.keys || []), normalizeNameKey(sourceName)]);
    try {
      await update(ref(db, `${PATHS.playerRatings}/${id}`), { aliases, keys });
      setStatus(`Saved → ${targetRow.fullName}`);
      onSaved?.(sourceName);
    } catch (error) {
      setStatus(error.message || 'Unable to save mapping');
    }
  }

  return (
    <tr data-testid={`ptl-name-map-${sourceName}`}>
      <td><strong>{sourceName}</strong></td>
      <td>
        {suggestions.length > 0 ? (
          suggestions.map(item => (
            <button
              type="button"
              key={item.row.fullName}
              className={`tag ${item.score >= 0.72 ? 'tie' : ''}`}
              onClick={() => setTargetName(item.row.fullName)}
              style={{ marginRight: '.25rem', marginBottom: '.25rem' }}
              title={item.reason}
            >
              {item.row.fullName} · {Math.round(item.score * 100)}%
            </button>
          ))
        ) : '—'}
      </td>
      <td>
        <select className="select" value={targetName} onChange={e => setTargetName(e.target.value)} data-testid={`ptl-name-map-${sourceName}-select`}>
          {lookupRows.map(row => <option key={row.fullName} value={row.fullName}>{row.fullName}</option>)}
        </select>
      </td>
      <td>
        <button type="button" className="btn small success" onClick={saveMapping} disabled={!canSave} data-testid={`ptl-name-map-${sourceName}-save`}>Map Name</button>
        {status && <div className="muted" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>{status}</div>}
      </td>
    </tr>
  );
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
          {player.aliases?.length > 0 && <div className="muted" style={{ fontSize: '.72rem' }}>aliases: {player.aliases.join(', ')}</div>}
          {!player.hasUtrLookup && <div className="muted" style={{ fontSize: '.72rem' }}>Needs UTR name mapping</div>}
        </td>
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
          {players.length === 0 && <tr><td colSpan="12" className="center muted">{emptyText}</td></tr>}
          <RatingRows players={players} startRank={startRank} highlightQualifiers={highlightQualifiers} />
        </tbody>
      </table>
    </div>
  );
}

function collectLegacyNames(matches, lookupRows) {
  const names = new Map();
  (matches || []).forEach(match => {
    (match.lines || []).forEach(line => {
      [...(line.players?.team1 || []), ...(line.players?.team2 || [])].forEach(name => {
        const clean = String(name || '').trim();
        if (!clean) return;
        if (!names.has(clean)) names.set(clean, { name: clean, count: 0 });
        names.get(clean).count += 1;
      });
    });
  });
  const mapped = Array.from(names.values()).map(item => {
    const match = matchUtrRating(item.name, lookupRows);
    return {
      ...item,
      matchedName: match?.row.fullName || '',
      singlesUtr: match?.row.singlesUtr ?? null,
      doublesUtr: match?.row.doublesUtr ?? null,
      confidence: match ? Math.round(match.score * 100) : 0,
      reason: match?.reason || 'Needs manual mapping'
    };
  });
  const matchedCounts = mapped.reduce((acc, row) => {
    if (row.matchedName) acc[row.matchedName] = (acc[row.matchedName] || 0) + 1;
    return acc;
  }, {});
  return mapped.map(row => ({ ...row, duplicateMappedName: row.matchedName && matchedCounts[row.matchedName] > 1 }))
    .sort((a, b) => a.confidence - b.confidence || a.name.localeCompare(b.name));
}

export default function PtlRatings({ teams, matches, previousMatches = [], ratingLookup = {} }) {
  const { session } = useAuth();
  const [q, setQ] = useState('');
  const [savedMappings, setSavedMappings] = useState([]);
  const [tab, setTab] = useState('ratings');
  const lookupRows = useMemo(() => {
    const entries = Object.entries(ratingLookup || {});
    const rows = entries.map(([id, row]) => ({ _id: id, ...(row || {}) }));
    return rows.length > 0 ? rows : UTR_RATINGS;
  }, [ratingLookup]);
  const ratingMatches = useMemo(() => [
    ...(previousMatches || []).map(match => ({ ...match, source: match.source || 'KOC2DB' })),
    ...(matches || []).map(match => ({ ...match, source: match.source || 'KOC3' }))
  ], [matches, previousMatches]);
  const ratings = useMemo(() => buildPtlRatings(teams, ratingMatches, lookupRows), [teams, ratingMatches, lookupRows]);
  const legacyNameMap = useMemo(() => collectLegacyNames(previousMatches, lookupRows), [previousMatches, lookupRows]);
  const filtered = ratings.filter(player =>
    !q || `${player.name} ${player.team} ${player.teamAbbr}`.toLowerCase().includes(q.toLowerCase())
  );

  const mappedPlayers = filtered.filter(player => player.hasUtrLookup);
  const unmappedPlayers = filtered.filter(player => !player.hasUtrLookup);
  const activeCount = ratings.filter(player => player.courts > 0).length;
  const unmappedCount = ratings.filter(player => !player.hasUtrLookup).length;
  const leader = ratings.find(player => player.courts > 0 && player.hasUtrLookup) || ratings.find(player => player.courts > 0);
  const needsMappingNames = useMemo(() => {
    const names = [
      ...unmappedPlayers.flatMap(player => [player.name, ...(player.aliases || [])]),
      ...legacyNameMap.filter(row => !row.matchedName).map(row => row.name)
    ];
    return uniqueValues(names).filter(name => !savedMappings.includes(name)).sort((a, b) => a.localeCompare(b));
  }, [legacyNameMap, savedMappings, unmappedPlayers]);
  const isAdmin = session.role === 'admin';

  return (
    <main className="container">
      <div className="page-title ptl-hero">
        <div>
          <h1>PTL Rating</h1>
          <p>UTR-style KOC performance rating using KOC3 plus pulled KOC2DB history.</p>
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
            the average rating of the opposing pair. Previous season matches are pulled from /KOC2DB.
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
        <button className={`tab ${tab === 'ratings' ? 'active' : ''}`} onClick={() => setTab('ratings')} data-testid="ptl-tab-ratings">PTL Ratings</button>
        <button className={`tab ${tab === 'lookup' ? 'active' : ''}`} onClick={() => setTab('lookup')} data-testid="ptl-tab-lookup">UTR Lookup</button>
        <button className={`tab ${tab === 'koc2map' ? 'active' : ''}`} onClick={() => setTab('koc2map')} data-testid="ptl-tab-koc2map">KOC2 Map</button>
        <button className={`tab ${tab === 'mapping' ? 'active' : ''}`} onClick={() => setTab('mapping')} data-testid="ptl-tab-mapping">Name Correction</button>
      </div>

      {tab === 'lookup' && (
        <div className="card">
          <h2>Stored Player Rating Lookup</h2>
          <p className="hint">This table is seeded into Firebase at {`/${'koc_s3/playerRatings'}`} and used to match KOC2DB names.</p>
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

      {tab === 'koc2map' && (
        <div className="card">
          <h2>KOC2DB Name Mapping</h2>
          <p className="hint">Partial matches from previous-season names to the stored UTR lookup. Duplicate mapped names are highlighted so aliases can be cleaned up.</p>
          <div className="table-wrap">
            <table className="std ptl-table" data-testid="ptl-koc2-map-table">
              <thead>
                <tr>
                  <th>KOC2 name</th>
                  <th>Plays</th>
                  <th>Mapped UTR player</th>
                  <th>Confidence</th>
                  <th>Reason</th>
                  <th>UTR S</th>
                  <th>UTR D</th>
                </tr>
              </thead>
              <tbody>
                {legacyNameMap.length === 0 && <tr><td colSpan="7" className="center muted">No KOC2DB player names loaded yet</td></tr>}
                {legacyNameMap.map(row => (
                  <tr key={row.name} className={row.duplicateMappedName ? 'q' : ''}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.count}</td>
                    <td>{row.matchedName || '—'}</td>
                    <td><span className={`tag ${row.confidence >= 90 ? 'win' : row.confidence >= 72 ? 'tie' : 'lose'}`}>{row.confidence}%</span></td>
                    <td>{row.duplicateMappedName ? `${row.reason} · duplicate alias` : row.reason}</td>
                    <td>{formatRating(row.singlesUtr)}</td>
                    <td>{formatRating(row.doublesUtr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {tab === 'mapping' && (
        <div className="card" data-testid="ptl-name-correction-card">
          <h2>PTL Name Correction</h2>
          <p className="hint">
            Admins can map misspelled, short, or legacy PTL names to the actual UTR lookup player. Saving adds the source name as an alias under /koc_s3/playerRatings, so hardcoded aliases are no longer needed.
          </p>
          {!isAdmin && <div className="error-box">Sign in as admin to save name mappings. You can still review fuzzy suggestions here.</div>}
          <div className="table-wrap">
            <table className="std ptl-table" data-testid="ptl-name-correction-table">
              <thead>
                <tr>
                  <th>Source name needing correction</th>
                  <th>Fuzzy suggestions</th>
                  <th>Actual UTR player</th>
                  <th>Admin action</th>
                </tr>
              </thead>
              <tbody>
                {needsMappingNames.length === 0 && <tr><td colSpan="4" className="center muted">All loaded PTL names are mapped.</td></tr>}
                {needsMappingNames.map(name => (
                  <NameMappingRow
                    key={name}
                    sourceName={name}
                    lookupRows={lookupRows}
                    onSaved={savedName => setSavedMappings(prev => uniqueValues([...prev, savedName]))}
                    canSave={isAdmin}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ratings' && (
        <>
          <div className="card">
            <h2>Mapped PTL Ratings <span className="muted" style={{ fontWeight: 500, fontSize: '.85rem' }}>· matched to UTR names</span></h2>
            <RatingTable players={mappedPlayers} emptyText="No mapped players found" />
            <p className="hint">PTL = Prosper Tennis League rating. UTR S/D come from the provided lookup table; PTL S/D are KOC-only singles and doubles performance ratings.</p>
          </div>

          {unmappedPlayers.length > 0 && (
            <div className="card ptl-unmapped-card" data-testid="ptl-unmapped-card">
              <h2>Needs Name Mapping <span className="muted" style={{ fontWeight: 500, fontSize: '.85rem' }}>· not found in UTR lookup</span></h2>
              <p className="hint">These players are kept below the main mapped group because their current or legacy match name did not resolve to a stored UTR player. Use the Name Correction tab to map the source name to an actual UTR player to move them into the mapped table.</p>
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
