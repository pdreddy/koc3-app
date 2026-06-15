import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ref, remove } from 'firebase/database';
import { db, PATHS } from '../firebase';

export default function History({ matches, teams }) {
  const [openId, setOpenId] = useState(null);
  const { session } = useAuth();

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete match ${m.t1} vs ${m.t2}?`)) return;
    try {
      await remove(ref(db, `${PATHS.matches}/${m.id}`));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <main className="container">
      <div className="page-title">
        <h1>Match History</h1>
        <p>{matches.length} match{matches.length === 1 ? '' : 'es'} played</p>
      </div>

      {matches.length === 0 && (
        <div className="card center muted" data-testid="history-empty">No matches yet. Sign in as a captain to enter scores.</div>
      )}

      {matches.map((m) => (
        <div className="match-hist" key={m.id} data-testid={`match-${m.id}`}>
          <div className="teams">{m.t1} vs {m.t2}</div>
          <div className="meta">
            <div>
              <span className="tag win">{m.win} won</span>
              <span style={{ marginLeft: '.4rem' }}>{m.g1}–{m.g2} games · {m.s1}–{m.s2} sets</span>
            </div>
            <small>{new Date(m.ts).toLocaleString()}</small>
          </div>
          {Array.isArray(m.lines) && m.lines.length > 0 && (
            <>
              <button
                className="btn small ghost"
                style={{ marginTop: '.5rem' }}
                onClick={() => setOpenId(openId === m.id ? null : m.id)}
                data-testid={`match-toggle-${m.id}`}
              >
                {openId === m.id ? 'Hide details' : 'Show details'}
              </button>
              {openId === m.id && (
                <div className="lines" data-testid={`match-lines-${m.id}`}>
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
          {session.role === 'admin' && (
            <button
              className="btn small danger"
              style={{ marginTop: '.5rem', marginLeft: '.4rem' }}
              onClick={() => handleDelete(m)}
              data-testid={`match-delete-${m.id}`}
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </main>
  );
}
