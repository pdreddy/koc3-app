import React from 'react';

export default function Rules() {
  return (
    <main className="container">
      <div className="page-title">
        <h1>Tournament Rules</h1>
        <p>Format & scoring rules for KOC3</p>
      </div>

      <div className="card">
        <h2>📋 Format</h2>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7, fontSize: '.92rem' }}>
          <li>16 teams · 7 players each (including captain)</li>
          <li>Round-robin group stage</li>
          <li>Top 4 teams qualify for playoffs</li>
          <li>Each match has multiple courts: 1 Singles + 2 Doubles</li>
        </ul>
      </div>

      <div className="card">
        <h2>🎾 Scoring</h2>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7, fontSize: '.92rem' }}>
          <li>Best-of-3 sets per court</li>
          <li>First to 4 games wins a set</li>
          <li>At 3-3, play a 10-point tiebreak</li>
          <li>Team with most courts won = match winner</li>
          <li>1 Match Point awarded to the winning team</li>
        </ul>
      </div>

      <div className="card">
        <h2>🏆 Standings Tiebreakers</h2>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.7, fontSize: '.92rem' }}>
          <li>Match Points (wins)</li>
          <li>Set Differential (won − lost)</li>
          <li>Sets Won</li>
          <li>Game Differential</li>
          <li>Games Won</li>
        </ol>
      </div>
    </main>
  );
}
