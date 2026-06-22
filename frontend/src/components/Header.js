import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole, canViewAudit } from '../utils/roles';

const PRIMARY_LINKS = [
  { to: '/teams', label: 'Teams' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/matchups', label: 'Matchups' },
  { to: '/more', label: 'More' }
];

export default function AppHeader() {
  const { session, logout } = useAuth();
  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/teams" className="brand" data-testid="header-home" aria-label="KOC3 home">
        <span className="logo" aria-hidden="true">🏆</span>
        <span className="brand-copy">
          <strong>KOC3</strong>
          <small>Table Tennis League</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="Primary navigation">
        {[...PRIMARY_LINKS, ...(canViewAudit(session) ? [{ to: '/audit', label: 'Audit' }] : [])].map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
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
          <button onClick={logout} className="btn small ghost" data-testid="header-logout-btn">Logout</button>
        )}
      </div>
    </header>
  );
}
