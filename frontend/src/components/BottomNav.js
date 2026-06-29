import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole, isAdminRole } from '../utils/roles';

export const BOTTOM_NAV_MAX = 5;

const PUBLIC_TABS = [
  { to: '/', label: 'Home', icon: '⌂', testid: 'nav-home' },
  { to: '/schedule', label: 'Schedule', icon: '◷', testid: 'nav-schedule' },
  { to: '/standings', label: 'Standings', icon: '↗', testid: 'nav-standings' },
  { to: '/rules', label: 'Rules', icon: '✓', testid: 'nav-rules' },
  { to: '/more', label: 'More', icon: '•••', testid: 'nav-more' }
];

const CAPTAIN_TABS = [
  { to: '/', label: 'Home', icon: '⌂', testid: 'nav-home' },
  { to: '/score', label: 'Score', icon: '＋', testid: 'nav-score' },
  { to: '/schedule', label: 'Schedule', icon: '◷', testid: 'nav-schedule' },
  { to: '/standings', label: 'Standings', icon: '↗', testid: 'nav-standings' },
  { to: '/more', label: 'More', icon: '•••', testid: 'nav-more' }
];

export function getBottomNavTabs(session) {
  const tabs = hasRole(session, [ROLES.CAPTAIN]) || isAdminRole(session) ? CAPTAIN_TABS : PUBLIC_TABS;
  return tabs.slice(0, BOTTOM_NAV_MAX);
}

export default function BottomNav() {
  const { session } = useAuth();
  const tabs = getBottomNavTabs(session);
  return (
    <nav className="bottom-nav" data-testid="bottom-nav" style={{ '--bottom-nav-count': tabs.length }}>
      {tabs.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => isActive ? 'active' : ''}
          data-testid={t.testid}
        >
          <span className="ico">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
