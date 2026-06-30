import React, { useMemo, useState } from 'react';
import TeamLogo from '../components/TeamLogo';

function TeamCard({ t, isOpen, onToggle }) {
  const gradClass = `team-grad-${t.gradient || 1}`;
  const players = t.players || [];
  const captain = players.find(p => p.isCaptain) || players[0];
  const averageUtr = players
    .map(p => Number(p.actualUtr || p.utr))
    .filter(Boolean)
    .reduce((sum, utr, _idx, arr) => sum + (utr / arr.length), 0);

  return (
    <article className={`team-card team-card-redesign ${isOpen ? 'is-open' : ''}`} data-testid={`team-card-${t.abbreviation}`}>
      <button
        type="button"
        className={`team-header team-card-trigger ${gradClass}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        data-testid={`team-toggle-${t.abbreviation}`}
      >
        <TeamLogo team={t} size="lg" className="team-card-logo" />
        <span className="team-card-title">
          <strong>{t.name}</strong>
          <small>{captain?.name ? `Captain · ${captain.name}` : 'Roster details'}</small>
        </span>
        <span className="team-card-meta">
          <span className="abbr">{t.abbreviation}</span>
          <span className="team-card-count">{players.length} players</span>
        </span>
        <span className="team-card-chevron" aria-hidden="true">⌄</span>
      </button>

      <div className="team-card-summary" aria-hidden={isOpen ? 'true' : 'false'}>
        <span>Group {t.group || 'A'}</span>
        {averageUtr > 0 && <span>Avg UTR {averageUtr.toFixed(2)}</span>}
        <span>{isOpen ? 'Roster expanded' : 'Tap to view roster'}</span>
      </div>

      {isOpen && (
        <div className="team-body team-roster-grid">
          {players.map((p, i) => {
            const utr = p.actualUtr || p.utr || '';
            const captainPlayer = i === 0 || p.isCaptain;
            return (
              <div key={i} className={`player-row team-player-pill ${captainPlayer ? 'captain' : ''}`} data-testid={`team-${t.abbreviation}-player-${i}`}>
                <span className="player-badge">{captainPlayer ? 'C' : i + 1}</span>
                <span className="player-name">{p.name}</span>
                {utr && <span className="player-utr">UTR {utr}</span>}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function Teams({ teams, loaded }) {
  const [open, setOpen] = useState({});
  const list = useMemo(() => Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0)), [teams]);
  const groupA = useMemo(() => list.filter(t => (t.group || 'A') === 'A'), [list]);
  const groupB = useMemo(() => list.filter(t => t.group === 'B'), [list]);

  if (!loaded) {
    return (
      <main className="container teams-page">
        <div className="page-title teams-hero"><h1>Tournament Teams</h1><p>Loading teams…</p></div>
      </main>
    );
  }

  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const renderColumn = (label, teamsList, testid) => (
    <section className="teams-group-panel" data-testid={testid}>
      <div className="group-col-title teams-group-title" data-testid={`teams-group-${label.toLowerCase()}-header`}>
        <span className="teams-group-badge">{label}</span>
        <div>
          <h2>Group {label}</h2>
          <p>{teamsList.length} teams competing</p>
        </div>
      </div>
      <div className="teams-list teams-redesign-list">
        {teamsList.map(t => (
          <TeamCard
            key={t.id}
            t={t}
            isOpen={!!open[t.id]}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <main className="container teams-page">
      <div className="page-title teams-hero">
        <h1>Tournament Teams</h1>
        <p>{list.length} teams · 2 groups of 8 · Expand any team for the full roster</p>
      </div>

      <div className="groups-grid teams-redesign-grid">
        {renderColumn('A', groupA, 'teams-list-a')}
        {renderColumn('B', groupB, 'teams-list-b')}
      </div>
    </main>
  );
}
