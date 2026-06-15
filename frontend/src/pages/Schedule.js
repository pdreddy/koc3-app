import React, { useMemo, useState } from 'react';
import { scheduleData, playoffs } from '../data/scheduleData';

function allTeams() {
  const set = new Set();
  scheduleData.forEach(w => {
    if (w.break) return;
    (w.matches || []).forEach(m => m.teams.forEach(t => set.add(t)));
    if (w.bye) set.add(w.bye);
  });
  return Array.from(set).sort();
}

export default function Schedule() {
  const [filter, setFilter] = useState('all');
  const teams = useMemo(allTeams, []);

  return (
    <main className="container">
      <div className="page-title">
        <h1>Schedule</h1>
        <p>9 weeks · Round-robin · Fri/Sat matches</p>
      </div>

      <div className="card">
        <div className="field">
          <div className="field-label">Filter by team</div>
          <select
            className="select"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            data-testid="schedule-team-filter"
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {filter !== 'all' && (
          <button className="btn small ghost" onClick={() => setFilter('all')} data-testid="schedule-clear-filter">
            Clear filter
          </button>
        )}
      </div>

      {scheduleData.map((w, i) => {
        if (w.break) {
          return (
            <div className="card" key={i} style={{ background: 'linear-gradient(135deg,#fed7d7,#feb2b2)', color: '#742a2a', textAlign: 'center' }} data-testid={`schedule-break-${i}`}>
              <div style={{ fontSize: '2rem' }}>{w.icon}</div>
              <strong>{w.text}</strong>
              <div style={{ marginTop: '.25rem' }}>{w.dates}</div>
            </div>
          );
        }

        const visibleMatches = (w.matches || []).filter(m => filter === 'all' || m.teams.includes(filter));
        const showBye = filter === 'all' || filter === w.bye;
        if (filter !== 'all' && visibleMatches.length === 0 && !showBye) return null;

        return (
          <div className="card" key={i} data-testid={`schedule-week-${w.week}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem', paddingBottom: '.5rem', borderBottom: '2px solid var(--ring)' }}>
              <span className="tag" style={{ background: 'linear-gradient(135deg,var(--bg1),var(--bg2))', color: '#fff', padding: '.3rem .7rem', fontSize: '.78rem' }}>Week {w.week}</span>
              <span className="muted" style={{ fontWeight: 700, fontSize: '.85rem' }}>{w.dates}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {visibleMatches.map((m, idx) => {
                const dayColor = m.day === 'FRI' ? '#2563eb' : '#d97706';
                return (
                  <div key={idx} data-testid={`schedule-match-${w.week}-${idx}`} style={{
                    display: 'flex', gap: '.6rem', alignItems: 'center',
                    background: '#f8fafc', borderLeft: `4px solid ${dayColor}`,
                    borderRadius: 10, padding: '.6rem'
                  }}>
                    <div style={{
                      background: '#fff', borderRadius: 8, padding: '.4rem .55rem',
                      minWidth: 56, textAlign: 'center', color: dayColor,
                      fontWeight: 900, fontSize: '.82rem'
                    }}>
                      <div>{m.day}</div>
                      <div style={{ color: 'var(--ink)', fontSize: '.78rem', marginTop: 2 }}>{m.time}</div>
                    </div>
                    <div style={{ flex: 1, fontSize: '.88rem' }}>
                      <div style={{ fontWeight: 800 }}>{m.teams[0]} <span className="muted" style={{ fontWeight: 600 }}>({m.captains[0]})</span></div>
                      <div className="muted" style={{ fontWeight: 800, textAlign: 'center', fontSize: '.75rem' }}>vs</div>
                      <div style={{ fontWeight: 800 }}>{m.teams[1]} <span className="muted" style={{ fontWeight: 600 }}>({m.captains[1]})</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {showBye && w.bye && (
              <div style={{
                marginTop: '.6rem', padding: '.55rem .8rem',
                background: 'linear-gradient(135deg,#fef5e7,#fdeaa8)',
                border: '2px solid #f6e05e', borderRadius: 10,
                color: '#744210', fontWeight: 800, textAlign: 'center', fontSize: '.88rem'
              }} data-testid={`schedule-bye-${w.week}`}>
                🛌 Bye: {w.bye}
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        <h2 style={{ textAlign: 'center', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 900 }}>
          🏆 Playoffs
        </h2>
        <div style={{ display: 'grid', gap: '.6rem' }}>
          {playoffs.map((p, i) => (
            <div key={i} data-testid={`playoff-${i}`} style={{
              background: '#f8fafc', border: '2px solid var(--ring)',
              borderRadius: 12, padding: '.8rem'
            }}>
              <div style={{
                background: p.final ? 'linear-gradient(135deg,#d69e2e,#b7791f)' : 'linear-gradient(135deg,var(--bg1),var(--bg2))',
                color: '#fff', borderRadius: 8, padding: '.45rem .65rem',
                fontWeight: 900, textAlign: 'center', marginBottom: '.4rem', fontSize: '.9rem'
              }}>{p.name}</div>
              <div className="muted center" style={{ fontWeight: 800, fontSize: '.85rem' }}>{p.date}</div>
              <div className="center" style={{ fontWeight: 900, margin: '.35rem 0', fontSize: '.95rem' }}>{p.match}</div>
              <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {p.tags.map(([cls, text], j) => (
                  <span key={j} className={`tag ${cls === 'w' ? 'win' : cls === 'l' ? 'tie' : 'lose'}`}>{text}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
