import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_ADMIN_USERS, ROLES } from '../config/roles';
import { AUDIT_ACTIONS, logAudit } from '../utils/audit';

export default function Login({ teams, adminConfig, adminUsers }) {
  const [mode, setMode] = useState('team'); // 'team' | 'admin'
  const [teamId, setTeamId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginAdmin, loginTeam } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || (mode === 'admin' ? '/admin' : '/score');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  // Live admin accounts (Firebase) fall back to the bundled defaults.
  const accounts = (adminUsers && Object.keys(adminUsers).length > 0) ? adminUsers : DEFAULT_ADMIN_USERS;

  const resolveAdmin = (rawUser, rawPwd) => {
    const key = String(rawUser || '').trim().toLowerCase();
    const pwd = String(rawPwd || '').trim();
    const account = accounts[key];
    if (account && pwd === String(account.password || '').trim()) {
      return { username: key, name: account.name || key, role: account.role || ROLES.ADMIN };
    }
    // Backward compatibility: legacy single shared admin password → SUPER_ADMIN.
    const legacy = String(adminConfig?.password || '').trim();
    if (legacy && pwd === legacy) {
      const fallback = accounts[key] || accounts.damureddi || {};
      return { username: key || 'damureddi', name: fallback.name || 'Super Admin', role: ROLES.SUPER_ADMIN };
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'admin') {
      if (!username.trim()) { setError('Enter your admin username.'); return; }
      const admin = resolveAdmin(username, password);
      if (!admin) { setError('Incorrect admin username or password.'); return; }
      loginAdmin(admin);
      logAudit({ role: 'admin', adminRole: admin.role, adminName: admin.name, username: admin.username },
        AUDIT_ACTIONS.LOGIN, { targetType: 'session', targetId: admin.username });
      navigate(next, { replace: true });
    } else {
      if (!teamId) { setError('Please choose your team.'); return; }
      const team = teams[teamId];
      if (!team) { setError('Team not found.'); return; }
      if (password.trim() === String(team.password || '')) {
        loginTeam(team.id, team.name);
        logAudit({ role: 'team', teamId: team.id, teamName: team.name },
          AUDIT_ACTIONS.LOGIN, { targetType: 'session', targetId: team.id });
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

          {mode === 'admin' && (
            <div className="field">
              <div className="field-label">Admin Username</div>
              <input
                type="text"
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. damureddi"
                autoComplete="username"
                data-testid="login-admin-username"
              />
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
