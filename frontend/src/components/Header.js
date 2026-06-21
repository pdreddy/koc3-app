import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        {PRIMARY_LINKS.map(link => (
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
        {session.role === 'admin' && (
          <span className="user-pill" data-testid="user-pill">ADMIN</span>
        )}
        {session.role === 'team' && (
          <span className="user-pill" data-testid="user-pill">{session.teamName}</span>
        )}
        {session.role === 'guest' && (
          <Link to="/login" className="user-pill" data-testid="header-login-link">LOGIN</Link>
        )}
        {session.role !== 'guest' && (
          <button onClick={logout} className="btn small ghost" data-testid="header-logout-btn">Logout</button>
        )}
      </div>
    </header>
  );
}
