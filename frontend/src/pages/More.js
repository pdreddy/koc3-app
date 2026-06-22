import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from '../components/ui/PageLayout';

export default function More() {
  const { session, logout } = useAuth();

  const items = [
    { to: '/ptl', icon: '📈', label: 'PPRC Rating', desc: 'Neat KOC performance rating beside current UTR', testid: 'more-ptl' },
    { to: '/history', icon: '📜', label: 'Match History', desc: 'View past results', testid: 'more-history' },
    { to: '/season2', icon: '🏆', label: 'Season 2 Archive', desc: 'Previous season standings & matches', testid: 'more-season2' },
    { to: '/rules', icon: '📋', label: 'Rules', desc: 'Format, scoring & tiebreakers', testid: 'more-rules' }
  ];

  if (session.role === 'guest') {
    items.push({ to: '/login', icon: '🔒', label: 'Captain / Admin Login', desc: 'Sign in to enter scores', testid: 'more-login' });
  } else if (session.role === 'team') {
    items.push({ to: '/score', icon: '✍️', label: 'Enter Score', desc: `Logged in as ${session.teamName}`, testid: 'more-score' });
  } else if (session.role === 'admin') {
    items.push({ to: '/score', icon: '✍️', label: 'Enter Score', desc: 'Admin score entry', testid: 'more-score' });
    items.push({ to: '/admin', icon: '⚙️', label: 'Admin Dashboard', desc: 'Manage teams & passwords', testid: 'more-admin' });
  }

  return (
    <PageLayout title="More" subtitle="Everything else in one place">
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

        {session.role !== 'guest' && (
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
    </PageLayout>
  );
}
