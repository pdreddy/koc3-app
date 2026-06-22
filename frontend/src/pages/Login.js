import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../utils/roles';

export default function Login({ teams, adminConfig }) {
  const [mode, setMode] = useState('team'); // 'team' | 'admin'
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginAdmin, loginTeam } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || (mode === 'admin' ? '/admin' : '/score');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'admin') {
      const expected = (adminConfig?.password || '').trim();
      const superExpected = (adminConfig?.superAdminPassword || '').trim();
      if (!expected && !superExpected) {
        setError('Admin password not configured yet.');
        return;
      }
      if (superExpected && password.trim() === superExpected) {
        loginAdmin(ROLES.SUPER_ADMIN);
        navigate(next, { replace: true });
      } else if (expected && password.trim() === expected) {
        loginAdmin(ROLES.ADMIN);
        navigate(next, { replace: true });
      } else {
        setError('Incorrect admin password.');
      }
    } else {
      if (!teamId) { setError('Please choose your team.'); return; }
      const team = teams[teamId];
      if (!team) { setError('Team not found.'); return; }
      if (password.trim() === String(team.password || '')) {
        loginTeam(team.id, team.name);
        navigate('/score', { replace: true });
      } else {
        setError('Incorrect team password.');
      }
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card" data-testid="login-card">
        <h1>🏆 KOC3</h1>
        <p className="sub">Captains & organizers sign in</p>

        <div className="login-tabs" role="tablist">
          <button
            className={mode === 'team' ? 'active' : ''}
            onClick={() => { setMode('team'); setError(''); setPassword(''); }}
            data-testid="login-tab-team"
          >Team Captain</button>
          <button
            className={mode === 'admin' ? 'active' : ''}
            onClick={() => { setMode('admin'); setError(''); setPassword(''); setTeamId(''); }}
            data-testid="login-tab-admin"
          >Admin</button>
        </div>

        {error && <div className="error-box" data-testid="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'team' && (
            <div className="field">
              <div className="field-label">Your Team</div>
              <select
                className="select"
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                data-testid="login-team-select"
              >
                <option value="">— Select your team —</option>
                {teamList.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <div className="field-label">{mode === 'admin' ? 'Admin Password' : 'Team Password'}</div>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              data-testid="login-password-input"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn full" data-testid="login-submit-btn">
            Sign In
          </button>
        </form>

        <div className="hint center" style={{ marginTop: '.8rem' }}>
          Browsing only? <button
            type="button"
            className="btn small ghost"
            style={{ marginLeft: '.4rem' }}
            onClick={() => navigate('/teams')}
            data-testid="login-guest-btn"
          >Continue as Guest</button>
        </div>
      </div>
    </div>
  );
}
