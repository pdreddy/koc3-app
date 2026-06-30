import React, { useState } from 'react';
import TeamLogo from '../components/TeamLogo';

function TeamCard({ t, isOpen, onToggle }) {
  const gradClass = `team-grad-${t.gradient || 1}`;
  return (
    <div className="team-card" data-testid={`team-card-${t.abbreviation}`}>
      <div
        className={`team-header ${gradClass}`}
        onClick={onToggle}
        data-testid={`team-toggle-${t.abbreviation}`}
        style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}
      >
        <TeamLogo team={t} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{t.name}</h2>
          {t.captain && <div style={{ fontSize: '.78rem', opacity: 0.8, marginTop: '.1rem' }}>🏆 {t.captain}</div>}
        </div>
        <span className="abbr">{t.abbreviation}</span>
      </div>
      {isOpen && (
        <div className="team-body">
          {(t.players || []).map((p, i) => {
            const utr = p.actualUtr || p.utr || '';
            return (
              <div key={i} className={`player-row ${i === 0 || p.isCaptain ? 'captain' : ''}`} data-testid={`team-${t.abbreviation}-player-${i}`}>
                <span className="player-badge">{i === 0 || p.isCaptain ? '🏆' : '🎾'}</span>
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

export default function Teams({ teams, loaded }) {
  const [open, setOpen] = useState({});
  const list = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const groupA = list.filter(t => (t.group || 'A') === 'A');
  const groupB = list.filter(t => t.group === 'B');

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

      <div className="groups-grid">
        {renderColumn('A', groupA, 'teams-list-a')}
        {renderColumn('B', groupB, 'teams-list-b')}
      </div>
    </main>
  );
}
