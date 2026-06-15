import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TABS = [
  { to: '/teams', label: 'Teams', icon: '👥', testid: 'nav-teams' },
  { to: '/standings', label: 'Standings', icon: '📊', testid: 'nav-standings' },
  { to: '/history', label: 'Matches', icon: '📜', testid: 'nav-history' },
  { to: '/rules', label: 'Rules', icon: '📋', testid: 'nav-rules' }
];

export default function BottomNav() {
  const { session } = useAuth();
  const lastTab = session.role === 'admin'
    ? { to: '/admin', label: 'Admin', icon: '⚙️', testid: 'nav-admin' }
    : session.role === 'team'
      ? { to: '/score', label: 'Score', icon: '✍️', testid: 'nav-score' }
      : { to: '/login', label: 'Login', icon: '🔒', testid: 'nav-login' };
  const all = [...TABS, lastTab];
  return (
    <nav className="bottom-nav" data-testid="bottom-nav">
      {all.map(t => (
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
