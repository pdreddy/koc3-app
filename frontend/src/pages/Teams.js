import React, { useState } from 'react';

export default function Teams({ teams, loaded }) {
  const [open, setOpen] = useState({});
  const list = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  if (!loaded) {
    return (
      <main className="container">
        <div className="page-title"><h1>Tournament Teams</h1><p>Loading...</p></div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="page-title">
        <h1>Tournament Teams</h1>
        <p>{list.length} teams • 7 players each</p>
      </div>

      <div className="teams-list" data-testid="teams-list">
        {list.map((t) => {
          const isOpen = open[t.id] ?? true;
          const gradClass = `team-grad-${t.gradient || 1}`;
          return (
            <div className="team-card" key={t.id} data-testid={`team-card-${t.abbreviation}`}>
              <div
                className={`team-header ${gradClass}`}
                onClick={() => setOpen(o => ({ ...o, [t.id]: !isOpen }))}
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
        })}
      </div>
    </main>
  );
}
