import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole, canViewAudit } from '../utils/roles';
import { writeAuditLog } from '../services/AuditService';

const PRIMARY_LINKS = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/teams', label: 'Teams', icon: '◉' },
  { to: '/schedule', label: 'Schedule', icon: '▦' },
  { to: '/standings', label: 'Standings', icon: '↗' },
  { to: '/rules', label: 'Rules', icon: '✓' },
  { to: '/more', label: 'More', icon: '•••' }
];

export default function AppHeader() {
  const { session, logout } = useAuth();
  const canScore = hasRole(session, [ROLES.CAPTAIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]);
  const handleLogout = async () => {
    const currentSession = session;
    logout();
    await writeAuditLog({ actionType: 'Logout', session: currentSession, targetType: currentSession?.teamId ? 'team' : 'user', targetId: currentSession?.teamId || currentSession?.userId || currentSession?.role }).catch(() => {});
  };
  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/" className="brand" data-testid="header-home" aria-label="KOC3 home">
        <span className="menu-mark" aria-hidden="true">☰</span>
        <span className="brand-copy">
          <strong>KOC</strong>
          <small>Season 3</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="Primary navigation">
        {[...PRIMARY_LINKS, ...(canViewAudit(session) ? [{ to: '/audit', label: 'Audit' }] : [])].map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
        {canScore && (
          <Link to="/score" className="score-cta" data-testid="header-score-link">Submit Score</Link>
        )}
        {hasRole(session, [ROLES.ADMIN, ROLES.SUPER_ADMIN]) && (
          <span className="user-pill" data-testid="user-pill">ADMIN</span>
        )}
        {hasRole(session, [ROLES.CAPTAIN]) && (
          <span className="user-pill" data-testid="user-pill">{session.teamName}</span>
        )}
        {hasRole(session, [ROLES.GUEST]) && (
          <Link to="/login" className="user-pill" data-testid="header-login-link">LOGIN</Link>
        )}
        {!hasRole(session, [ROLES.GUEST]) && (
          <button onClick={handleLogout} className="btn small ghost" data-testid="header-logout-btn">Logout</button>
        )}
      </div>
    </header>
  );
}
