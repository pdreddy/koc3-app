import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, normalizeRole } from '../utils/roles';
import { normalizeAdminUsername } from '../data/initialTeams';
import { writeAuditLog } from '../services/AuditService';
import { supabase, teamAuthEmail, adminAuthEmail } from '../supabaseClient';

export default function Login({ teams }) {
  const [mode, setMode] = useState('team'); // 'team' | 'admin'
  const [teamId, setTeamId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { loginAdmin, loginTeam } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || (mode === 'admin' ? '/admin' : '/score');

  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'admin') {
        const username = normalizeAdminUsername(adminUsername);
        if (!username) { setError('Enter your admin username.'); return; }
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: adminAuthEmail(username),
          password: password.trim(),
        });
        if (authError || !data?.user) {
          setError(authError?.message ? `Login failed: ${authError.message}` : 'Incorrect admin username or password.');
          return;
        }
        // Role comes from the profile (which also drives the JWT claims + RLS).
        const { data: profile } = await supabase
          .from('profiles').select('role,name').eq('id', data.user.id).maybeSingle();
        const adminRole = normalizeRole(profile?.role) || ROLES.SUPER_ADMIN;
        const name = profile?.name || username;
        const nextSession = { role: adminRole, userId: username, name, loginAt: Date.now() };
        loginAdmin(adminRole, { username, name });
        // Audit is best-effort — never let it block or fail the login.
        writeAuditLog({ actionType: 'Login', session: nextSession, targetType: 'user', targetId: username }).catch(() => {});
        navigate(next, { replace: true });
      } else {
        if (!teamId) { setError('Please choose your team.'); return; }
        const team = teams[teamId];
        if (!team) { setError('Team not found.'); return; }
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: teamAuthEmail(team.id),
          password: password.trim(),
        });
        if (authError || !data?.user) {
          setError(authError?.message ? `Login failed: ${authError.message}` : 'Incorrect team password.');
          return;
        }
        const nextSession = { role: ROLES.CAPTAIN, teamId: team.id, teamName: team.name, loginAt: Date.now() };
        loginTeam(team.id, team.name);
        writeAuditLog({ actionType: 'Login', session: nextSession, targetType: 'team', targetId: team.id }).catch(() => {});
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(`Unexpected error: ${err?.message || err}`);
    } finally {
      setBusy(false);
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

          <button type="submit" className="btn full" data-testid="login-submit-btn" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
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
