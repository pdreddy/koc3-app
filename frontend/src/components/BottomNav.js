import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/teams', label: 'Teams', icon: '👥', testid: 'nav-teams' },
  { to: '/schedule', label: 'Schedule', icon: '📅', testid: 'nav-schedule' },
  { to: '/standings', label: 'Standings', icon: '📊', testid: 'nav-standings' },
  { to: '/matchups', label: 'Matchups', icon: '🎾', testid: 'nav-matchups' },
  { to: '/more', label: 'More', icon: '⋯', testid: 'nav-more' }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" data-testid="bottom-nav">
      {TABS.map(t => (
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
