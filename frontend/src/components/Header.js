import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { ROLES, hasRole, canViewAudit } from '../utils/roles';
import { samePath } from '../utils/navigation';
import { writeAuditLog } from '../services/AuditService';

const PRIMARY_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/teams', label: 'Teams' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/rules', label: 'Rules' },
  { to: '/more', label: 'More' }
];


export default function AppHeader() {
  const { session, logout } = useAuth();
  const { club } = useClub();
  const location = useLocation();
  const isHome = samePath(location.pathname, '/');
  const preventCurrentPageNavigation = (event, targetPath) => {
    if (samePath(location.pathname, targetPath)) event.preventDefault();
  };
  const handleLogout = async () => {
    const currentSession = session;
    logout();
    await writeAuditLog({ actionType: 'Logout', session: currentSession, targetType: currentSession?.teamId ? 'team' : 'user', targetId: currentSession?.teamId || currentSession?.userId || currentSession?.role }).catch(() => {});
  };
  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/" className="brand" data-testid="header-home" aria-label={`${club.shortName} home`} onClick={event => preventCurrentPageNavigation(event, '/')} aria-disabled={isHome ? 'true' : undefined}>
        <img src={club.branding.logoUrl} alt="" className="header-logo-img" aria-hidden="true" />
        <span className="brand-copy">
          <strong>{club.shortName}</strong>
          <small>{club.branding.tagline}</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="Primary navigation">
        {[...PRIMARY_LINKS, ...(canViewAudit(session) ? [{ to: '/audit', label: 'Audit' }] : [])].map(link => {
          const current = samePath(location.pathname, link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={event => preventCurrentPageNavigation(event, link.to)}
              aria-disabled={current ? 'true' : undefined}
            >
              {link.label}
            </NavLink>
          );
        })}
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
