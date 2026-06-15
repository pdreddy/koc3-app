import React, { useState } from 'react';

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
          {(t.players || []).map((p, i) => (
            <div key={i} className={`player-row ${p.isCaptain ? 'captain' : ''}`} data-testid={`team-${t.abbreviation}-player-${i}`}>
              <span className="player-badge">{p.isCaptain ? '🏆' : '🎾'}</span>
              <span className="player-name">{p.name}</span>
            </div>
          ))}
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

  return (
    <main className="container">
      <div className="page-title">
        <h1>Tournament Teams</h1>
        <p>{list.length} teams · 2 groups of 8 · 7 players each</p>
      </div>

      <h2 style={{ color: '#fff', marginBottom: '.6rem', fontSize: '1.05rem', textShadow: '0 1px 4px rgba(0,0,0,.25)' }} data-testid="teams-group-a-header">
        🅰️ Group A
      </h2>
      <div className="teams-list" data-testid="teams-list-a" style={{ marginBottom: '1rem' }}>
        {groupA.map(t => (
          <TeamCard
            key={t.id}
            t={t}
            isOpen={open[t.id] === undefined ? true : open[t.id]}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </div>

      <h2 style={{ color: '#fff', marginBottom: '.6rem', fontSize: '1.05rem', textShadow: '0 1px 4px rgba(0,0,0,.25)' }} data-testid="teams-group-b-header">
        🅱️ Group B
      </h2>
      <div className="teams-list" data-testid="teams-list-b">
        {groupB.map(t => (
          <TeamCard
            key={t.id}
            t={t}
            isOpen={open[t.id] === undefined ? true : open[t.id]}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </div>
    </main>
  );
}
