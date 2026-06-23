import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../utils/roles';
import { DEFAULT_ADMIN_USERS } from '../data/initialTeams';
import { writeAuditLog } from '../services/AuditService';

export default function Login({ teams, adminConfig }) {
  const [mode, setMode] = useState('team'); // 'team' | 'admin'
  const [teamId, setTeamId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginAdmin, loginTeam } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || (mode === 'admin' ? '/admin' : '/score');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'admin') {
      const username = adminUsername.trim().toLowerCase();
      const users = adminConfig?.users || {};
      const defaultUser = username ? DEFAULT_ADMIN_USERS[username] : null;
      const configuredUser = username ? users[username] : null;
      const adminUser = configuredUser || defaultUser;
      if (!username || !adminUser) {
        setError('Incorrect admin username or password.');
        return;
      }
      const centralPassword = String(adminConfig?.password || '').trim();
      const allowedPasswords = [configuredUser?.password, ...(configuredUser?.passwords || []), centralPassword].map(value => String(value || '').trim()).filter(Boolean);
      const expected = allowedPasswords[0] || '';
      if (!expected) {
        setError('Admin password not configured yet.');
        return;
      }
      if (allowedPasswords.includes(password.trim())) {
        const adminRole = adminUser?.role || adminConfig?.role || ROLES.SUPER_ADMIN;
        const nextSession = { role: adminRole, userId: username || adminRole, name: adminUser?.name || username || adminRole, loginAt: Date.now() };
        loginAdmin(adminRole, { username: nextSession.userId, name: nextSession.name });
        await writeAuditLog({ actionType: 'Login', session: nextSession, targetType: 'user', targetId: nextSession.userId });
        navigate(next, { replace: true });
      } else {
        setError('Incorrect admin username or password.');
      }
    } else {
      if (!teamId) { setError('Please choose your team.'); return; }
      const team = teams[teamId];
      if (!team) { setError('Team not found.'); return; }
      if (password.trim() === String(team.password || '')) {
        const nextSession = { role: ROLES.CAPTAIN, teamId: team.id, teamName: team.name, loginAt: Date.now() };
        loginTeam(team.id, team.name);
        await writeAuditLog({ actionType: 'Login', session: nextSession, targetType: 'team', targetId: team.id });
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
            onClick={() => { setMode('admin'); setError(''); setPassword(''); setTeamId(''); setAdminUsername(''); }}
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
                className="input"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                placeholder="Enter admin username"
                data-testid="login-admin-username-input"
                autoComplete="username"
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
