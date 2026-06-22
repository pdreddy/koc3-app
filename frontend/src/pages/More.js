import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole, canViewAudit } from '../utils/roles';

export default function More() {
  const { session, logout } = useAuth();

  const items = [
    { to: '/ptl', icon: '📈', label: 'PTL Rating', desc: 'Current UTR beside KOC performance rating', testid: 'more-ptl' },
    { to: '/history', icon: '📜', label: 'Match History', desc: 'View past results', testid: 'more-history' },
    { to: '/rules', icon: '📋', label: 'Rules', desc: 'Format, scoring & tiebreakers', testid: 'more-rules' }
  ];

  if (hasRole(session, [ROLES.GUEST])) {
    items.push({ to: '/login', icon: '🔒', label: 'Captain / Admin Login', desc: 'Sign in to enter scores', testid: 'more-login' });
  } else if (hasRole(session, [ROLES.CAPTAIN])) {
    items.push({ to: '/score', icon: '✍️', label: 'Enter Score', desc: `Logged in as ${session.teamName}`, testid: 'more-score' });
  } else if (hasRole(session, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
    items.push({ to: '/score', icon: '✍️', label: 'Enter Score', desc: 'Admin score entry', testid: 'more-score' });
    items.push({ to: '/admin', icon: '⚙️', label: 'Admin Dashboard', desc: 'Manage teams, schedules, and operations', testid: 'more-admin' });
    if (canViewAudit(session)) items.push({ to: '/audit', icon: '🧾', label: 'Audit Logs', desc: 'SUPER_ADMIN-only system activity', testid: 'more-audit' });
  }

  return (
    <main className="container">
      <div className="page-title">
        <h1>More</h1>
        <p>Everything else in one place</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }} data-testid="more-list">
        {items.map(it => (
          <Link
            key={it.to}
            to={it.to}
            className="card"
            data-testid={it.testid}
            style={{
              display: 'flex', alignItems: 'center', gap: '.85rem',
              marginBottom: 0, textDecoration: 'none', color: 'inherit'
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, var(--bg1), var(--bg2))',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.35rem', flexShrink: 0
            }}>{it.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '.98rem' }}>{it.label}</div>
              <div className="muted" style={{ fontSize: '.82rem' }}>{it.desc}</div>
            </div>
            <span style={{ color: 'var(--muted)', fontWeight: 900 }}>›</span>
          </Link>
        ))}

        {!hasRole(session, [ROLES.GUEST]) && (
          <button
            className="btn ghost full"
            onClick={logout}
            data-testid="more-logout-btn"
            style={{ marginTop: '.4rem' }}
          >
            Log out
          </button>
        )}
      </div>
    </main>
  );
}
