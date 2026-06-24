import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole, canViewAudit } from '../utils/roles';
import { writeAuditLog } from '../services/AuditService';

const PRIMARY_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/teams', label: 'Teams' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/matchups', label: 'Matchups' },
  { to: '/more', label: 'More' }
];

export default function AppHeader({ config }) {
  const { session, logout } = useAuth();
  const club = config?.club || {};
  const brandName = club.name || 'KOC3';
  const brandTagline = club.tagline || 'Tennis League';
  const brandLogo = club.logoEmoji || '🏆';
  const handleLogout = async () => {
    const currentSession = session;
    logout();
    await writeAuditLog({ actionType: 'Logout', session: currentSession, targetType: currentSession?.teamId ? 'team' : 'user', targetId: currentSession?.teamId || currentSession?.userId || currentSession?.role }).catch(() => {});
  };
  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/" className="brand" data-testid="header-home" aria-label={`${brandName} home`}>
        {club.logoUrl
          ? <img className="logo" src={club.logoUrl} alt="" aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          : <span className="logo" aria-hidden="true">{brandLogo}</span>}
        <span className="brand-copy">
          <strong>{brandName}</strong>
          <small>{brandTagline}</small>
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
          <button onClick={handleLogout} className="btn small ghost" data-testid="header-logout-btn">Logout</button>
        )}
      </div>
    </header>
  );
}
