import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ref, remove, update } from 'firebase/database';
import { db, PATHS } from '../firebase';
import { can, PERMISSIONS, ROLES } from '../config/roles';
import { AUDIT_ACTIONS, logAudit } from '../utils/audit';
import { matchTeamNames, matchWinnerId } from '../utils/matchTeams';

const STATUS_TAGS = {
  pending: { label: 'Pending approval', cls: 'tie' },
  approved: { label: 'Approved', cls: 'win' },
  rejected: { label: 'Rejected', cls: 'lose' }
};

export default function History({ matches, teams }) {
  const [openId, setOpenId] = useState(null);
  const { session, role } = useAuth();

  const canDelete = can(session, PERMISSIONS.DELETE_CORE_DATA);
  const canApprove = can(session, PERMISSIONS.APPROVE_SCORE);

  // A captain may only approve/reject a pending score for a match their team is
  // in that they did not enter themselves (i.e. the opponent's submission).
  const captainCanDecide = (m) => {
    if (role !== ROLES.CAPTAIN) return false;
    const involved = m.t1Id === session.teamId || m.t2Id === session.teamId;
    const enteredBySelf = (m.enteredByUserId || m.t1Id) === session.teamId;
    return involved && !enteredBySelf;
  };

  const showDecision = (m) => m.status === 'pending' && (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN ? canApprove : captainCanDecide(m));

  const decide = async (m, approve) => {
    try {
      await update(ref(db, `${PATHS.matches}/${m.id}`), { status: approve ? 'approved' : 'rejected' });
      await logAudit(session, approve ? AUDIT_ACTIONS.SCORE_APPROVAL : AUDIT_ACTIONS.SCORE_REJECTION, {
        targetType: 'match',
        targetId: m.id,
        oldValue: { status: m.status || 'pending' },
        newValue: { status: approve ? 'approved' : 'rejected' }
      });
    } catch (e) {
      alert('Action failed: ' + e.message);
    }
  };

  const handleDelete = async (m, names) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete match ${names.t1Name} vs ${names.t2Name}?`)) return;
    try {
      await remove(ref(db, `${PATHS.matches}/${m.id}`));
      await logAudit(session, AUDIT_ACTIONS.SCORE_EDIT, {
        targetType: 'match',
        targetId: m.id,
        oldValue: { t1: names.t1Name, t2: names.t2Name },
        newValue: { deleted: true }
      });
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

      {matches.map((m) => {
        const names = matchTeamNames(m, teams);
        const winnerId = matchWinnerId(m, teams);
        const winnerName = winnerId === names.team1Id ? names.t1Name : (winnerId === names.team2Id ? names.t2Name : (m.win || 'Unknown'));
        const statusTag = m.status ? STATUS_TAGS[m.status] : null;
        return (
          <div className="match-hist" key={m.id} data-testid={`match-${m.id}`}>
            <div className="teams">{names.t1Name} vs {names.t2Name}</div>
            <div className="meta">
              <div>
                <span className="tag win">{winnerName} won</span>
                <span style={{ marginLeft: '.4rem' }}>{m.g1}–{m.g2} games · {m.s1}–{m.s2} sets</span>
                {statusTag && <span className={`tag ${statusTag.cls}`} style={{ marginLeft: '.4rem' }} data-testid={`match-status-${m.id}`}>{statusTag.label}</span>}
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
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
              {showDecision(m) && (
                <>
                  <button className="btn small success" onClick={() => decide(m, true)} data-testid={`match-approve-${m.id}`}>Approve</button>
                  <button className="btn small danger" onClick={() => decide(m, false)} data-testid={`match-reject-${m.id}`}>Reject</button>
                </>
              )}
              {canDelete && (
                <button
                  className="btn small danger"
                  onClick={() => handleDelete(m, names)}
                  data-testid={`match-delete-${m.id}`}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}
