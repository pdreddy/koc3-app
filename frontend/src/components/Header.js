import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppHeader() {
  const { session, logout } = useAuth();
  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/teams" className="brand" data-testid="header-home">
        <span className="logo">🏆</span>
        <strong>KOC Season 2</strong>
      </Link>
      <div style={{display:'flex', gap:'.4rem', alignItems:'center'}}>
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
