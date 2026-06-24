import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, hasRole } from '../utils/roles';
import { playersRepo, joinRequestsRepo } from '../data/dataAccess';
import { registerPlayerAuth, signInPlayerAuth, resetPlayerPassword, changeCurrentPassword } from '../services/playerAccount';
import { isValidEmail, isValidPhone, rosterPlayerNames, playerIdFromName } from '../utils/playerAuth';

function Field({ label, children, hint }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="muted" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>{hint}</div>}
    </div>
  );
}

function findPlayerByEmail(players, email) {
  const target = String(email || '').trim().toLowerCase();
  const entry = Object.entries(players || {}).find(([, rec]) => String(rec?.email || '').trim().toLowerCase() === target);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

// ---- Sign in --------------------------------------------------------------
function SignIn({ players }) {
  const { loginPlayer } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg('');
    if (!isValidEmail(email)) return setMsg('Enter a valid email.');
    try {
      setBusy(true);
      await signInPlayerAuth(email, password);
      const record = findPlayerByEmail(players, email);
      loginPlayer(record || { name: email.split('@')[0], email });
      setMsg('✅ Signed in.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setMsg('');
    if (!isValidEmail(email)) return setMsg('Enter your email first, then tap reset.');
    try {
      await resetPlayerPassword(email);
      setMsg('✅ Password reset email sent.');
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="card" data-testid="register-signin">
      <h2>Sign In</h2>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}
      <Field label="Email"><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="signin-email" autoComplete="username" /></Field>
      <Field label="Password"><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="signin-password" autoComplete="current-password" /></Field>
      <button className="btn full" onClick={submit} disabled={busy} data-testid="signin-submit">Sign In</button>
      <button className="btn ghost full" style={{ marginTop: '.4rem' }} onClick={forgot} data-testid="signin-forgot">Forgot password?</button>
    </div>
  );
}

// ---- New registration: individual, or claim a roster spot -----------------
function NewRegistration({ teams, players }) {
  const { loginPlayer } = useAuth();
  const roster = useMemo(() => Array.from(rosterPlayerNames(teams).values()).sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const [mode, setMode] = useState('individual'); // 'individual' | 'claim'
  const [claimQuery, setClaimQuery] = useState('');
  const [claimId, setClaimId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const claimMatches = useMemo(() => {
    const q = claimQuery.trim().toLowerCase();
    if (!q) return [];
    return roster.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [claimQuery, roster]);
  const claimTarget = roster.find(p => playerIdFromName(p.name) === claimId);

  const submit = async () => {
    setMsg('');
    const name = mode === 'claim' ? (claimTarget?.name || '') : form.name.trim();
    if (!name) return setMsg(mode === 'claim' ? 'Pick your roster name to claim.' : 'Name is required.');
    if (!isValidEmail(form.email)) return setMsg('Enter a valid email.');
    if (!isValidPhone(form.phone)) return setMsg('Enter a valid phone number.');
    if (form.password.length < 6) return setMsg('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setMsg('Passwords do not match.');

    const playerId = playerIdFromName(name);
    if (players?.[playerId]?.authUid) return setMsg('This player is already registered. Use Sign In or reset your password.');

    try {
      setBusy(true);
      const authUid = await registerPlayerAuth(form.email, form.password);
      const teamId = mode === 'claim' ? (claimTarget?.teamId || '') : '';
      const record = {
        id: playerId,
        name,
        email: form.email.trim(),
        phone: form.phone.trim(),
        membershipType: teamId ? 'team' : 'individual',
        teamId,
        authUid,
        claimed: true,
        createdAt: players?.[playerId]?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      await playersRepo().upsert(playerId, record);
      loginPlayer(record);
      setMsg(`✅ Welcome, ${name}! Your profile is ready.`);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" data-testid="register-new">
      <h2>Register</h2>
      <div className="tabs" style={{ marginBottom: '.6rem' }}>
        <button className={`tab ${mode === 'individual' ? 'active' : ''}`} onClick={() => setMode('individual')} data-testid="register-mode-individual">New individual</button>
        <button className={`tab ${mode === 'claim' ? 'active' : ''}`} onClick={() => setMode('claim')} data-testid="register-mode-claim">Claim my roster spot</button>
      </div>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}

      {mode === 'individual' ? (
        <Field label="Full Name"><input className="input" value={form.name} onChange={e => set({ name: e.target.value })} data-testid="register-name" /></Field>
      ) : (
        <>
          <Field label="Find your roster name">
            <input className="input" value={claimQuery} onChange={e => { setClaimQuery(e.target.value); setClaimId(''); }} placeholder="Type your name" data-testid="register-claim-search" />
          </Field>
          {claimQuery && !claimId && (
            <div style={{ display: 'grid', gap: '.3rem', marginBottom: '.5rem' }}>
              {claimMatches.length === 0 && <p className="muted">No roster match — register as a new individual instead.</p>}
              {claimMatches.map(p => (
                <button key={p.name} type="button" className="btn small ghost" onClick={() => setClaimId(playerIdFromName(p.name))} data-testid={`register-claim-${playerIdFromName(p.name)}`} style={{ textAlign: 'left' }}>
                  {p.name} · {p.abbreviation || p.teamName}
                  {players?.[playerIdFromName(p.name)]?.authUid ? ' · 🔒 already registered' : ''}
                </button>
              ))}
            </div>
          )}
          {claimTarget && <p className="hint">Claiming <strong>{claimTarget.name}</strong> ({claimTarget.abbreviation || claimTarget.teamName}). <button type="button" className="btn small ghost" onClick={() => { setClaimId(''); }}>change</button></p>}
        </>
      )}

      <div className="row">
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => set({ email: e.target.value })} data-testid="register-email" /></Field>
        <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} data-testid="register-phone" /></Field>
      </div>
      <div className="row">
        <Field label="Password" hint="At least 6 characters"><input className="input" type="password" value={form.password} onChange={e => set({ password: e.target.value })} data-testid="register-password" /></Field>
        <Field label="Confirm Password"><input className="input" type="password" value={form.confirm} onChange={e => set({ confirm: e.target.value })} data-testid="register-confirm" /></Field>
      </div>
      <button className="btn full success" onClick={submit} disabled={busy} data-testid="register-submit">Create Account</button>
      <p className="hint" style={{ marginTop: '.4rem' }}>Individuals can request to join a team after registering, from your profile.</p>
    </div>
  );
}

// ---- Logged-in profile + request to join a team ---------------------------
function MyProfile({ teams, players, joinRequests }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const record = players?.[session.playerId] || {};
  const [phone, setPhone] = useState(record.phone || session.email || '');
  const [newPw, setNewPw] = useState('');
  const [joinTeamId, setJoinTeamId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const myTeam = teams?.[record.teamId];
  const pendingRequest = Object.values(joinRequests || {}).find(r => r.playerId === session.playerId && r.status === 'pending');

  const saveProfile = async () => {
    setMsg('');
    if (phone && !isValidPhone(phone)) return setMsg('Enter a valid phone number.');
    try {
      setBusy(true);
      await playersRepo().upsert(session.playerId, { phone: String(phone).trim(), updatedAt: Date.now() });
      setMsg('✅ Profile updated.');
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const updatePw = async () => {
    setMsg('');
    if (newPw.length < 6) return setMsg('Password must be at least 6 characters.');
    try {
      setBusy(true);
      await changeCurrentPassword(newPw);
      setNewPw('');
      setMsg('✅ Password changed.');
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const requestJoin = async () => {
    setMsg('');
    if (!joinTeamId) return setMsg('Choose a team to request.');
    try {
      setBusy(true);
      await joinRequestsRepo().add({
        playerId: session.playerId,
        name: record.name || session.name,
        email: record.email || session.email,
        teamId: joinTeamId,
        teamName: teams?.[joinTeamId]?.name || '',
        status: 'pending',
        requestedAt: Date.now()
      });
      setMsg('✅ Request sent — an organizer will review it.');
      setJoinTeamId('');
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" data-testid="register-profile">
      <h2>My Profile</h2>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}
      <div className="rl-item"><span className="rl-ic">👤</span><div><div className="rl-lbl">{record.name || session.name}</div><div className="rl-val">{record.email || session.email} · {myTeam ? `${myTeam.name} (${myTeam.abbreviation})` : 'No team yet'}</div></div></div>

      <Field label="Phone"><input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} data-testid="profile-phone" /></Field>
      <button className="btn full success" onClick={saveProfile} disabled={busy} data-testid="profile-save">Save Profile</button>

      <div className="field-label" style={{ marginTop: '.8rem' }}>Change Password</div>
      <div style={{ display: 'flex', gap: '.4rem' }}>
        <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" data-testid="profile-newpw" />
        <button className="btn" onClick={updatePw} disabled={busy} data-testid="profile-changepw">Update</button>
      </div>

      {!myTeam && (
        <>
          <div className="field-label" style={{ marginTop: '.8rem' }}>Request to Join a Team</div>
          {pendingRequest ? (
            <div className="rl-flag warn"><span aria-hidden="true">⏳</span><span>Request pending for {pendingRequest.teamName || 'a team'}.</span></div>
          ) : (
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <select className="select" value={joinTeamId} onChange={e => setJoinTeamId(e.target.value)} data-testid="profile-join-team">
                <option value="">— Select team —</option>
                {teamList.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}
              </select>
              <button className="btn" onClick={requestJoin} disabled={busy} data-testid="profile-join-submit">Request</button>
            </div>
          )}
        </>
      )}

      <button className="btn ghost full" style={{ marginTop: '.8rem' }} onClick={() => { logout(); navigate('/'); }} data-testid="profile-signout">Sign Out</button>
    </div>
  );
}

export default function Register({ teams, players, joinRequests }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('register');
  const isPlayer = hasRole(session, [ROLES.PLAYER]);

  return (
    <main className="container" data-testid="register-page">
      <div className="page-title">
        <h1>Player Registration</h1>
        <p>Register for the season, claim your roster spot, or manage your profile, password and team.</p>
      </div>

      {isPlayer ? (
        <MyProfile teams={teams} players={players} joinRequests={joinRequests} />
      ) : (
        <>
          <div className="tabs">
            <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')} data-testid="register-tab-new">Register</button>
            <button className={`tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => setTab('signin')} data-testid="register-tab-signin">Sign In</button>
          </div>
          {tab === 'register' ? <NewRegistration teams={teams} players={players} /> : <SignIn players={players} />}
        </>
      )}

      <button className="btn ghost full" style={{ marginTop: '.6rem' }} onClick={() => navigate('/')}>Back to Home</button>
    </main>
  );
}
