import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playersRepo } from '../data/dataAccess';
import {
  hashPassword, verifyPassword, isValidEmail, isValidPhone,
  rosterPlayerNames, playerIdFromName, MEMBERSHIP_TYPES
} from '../utils/playerAuth';

function Field({ label, children, hint }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="muted" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>{hint}</div>}
    </div>
  );
}

// Merge registered players with roster names so a person can claim an existing
// roster entry or register fresh.
function useKnownPlayers(teams, players) {
  return useMemo(() => {
    const roster = rosterPlayerNames(teams);
    const map = new Map();
    roster.forEach((info, id) => map.set(id, { id, ...info, registered: false }));
    Object.entries(players || {}).forEach(([id, rec]) => {
      const prev = map.get(id) || {};
      map.set(id, { id, name: rec.name || prev.name, teamId: rec.teamId || prev.teamId, teamName: prev.teamName, abbreviation: prev.abbreviation, registered: true, hasPassword: !!rec.passwordHash });
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [teams, players]);
}

function NewRegistration({ teams, players }) {
  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const [form, setForm] = useState({ name: '', email: '', phone: '', membership: 'team', teamId: '', password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const submit = async () => {
    setMsg('');
    if (!form.name.trim()) return setMsg('Name is required.');
    if (!isValidEmail(form.email)) return setMsg('Enter a valid email.');
    if (!isValidPhone(form.phone)) return setMsg('Enter a valid phone number.');
    if (form.membership === 'team' && !form.teamId) return setMsg('Choose the team you are registering under.');
    if (form.password.length < 4) return setMsg('Password must be at least 4 characters.');
    if (form.password !== form.confirm) return setMsg('Passwords do not match.');

    const playerId = playerIdFromName(form.name);
    const existing = players?.[playerId];
    if (existing?.passwordHash) {
      return setMsg('A profile with this name already exists. Use "Find / Edit My Profile" to manage it.');
    }
    try {
      setBusy(true);
      const passwordHash = await hashPassword(form.password);
      await playersRepo().upsert(playerId, {
        id: playerId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        membershipType: form.membership,
        teamId: form.membership === 'team' ? form.teamId : '',
        passwordHash,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now()
      });
      setMsg(`✅ Registered ${form.name.trim()}. You can now manage your profile anytime.`);
      setForm({ name: '', email: '', phone: '', membership: 'team', teamId: '', password: '', confirm: '' });
    } catch (e) {
      setMsg('Registration failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" data-testid="register-new">
      <h2>New Registration</h2>
      <p className="hint">Register as a new player — individually, under a club, or under a specific team.</p>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}
      <Field label="Full Name"><input className="input" value={form.name} onChange={e => set({ name: e.target.value })} data-testid="register-name" /></Field>
      <div className="row">
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => set({ email: e.target.value })} data-testid="register-email" /></Field>
        <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} data-testid="register-phone" /></Field>
      </div>
      <div className="row">
        <Field label="Membership">
          <select className="select" value={form.membership} onChange={e => set({ membership: e.target.value })} data-testid="register-membership">
            {MEMBERSHIP_TYPES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        {form.membership === 'team' && (
          <Field label="Team">
            <select className="select" value={form.teamId} onChange={e => set({ teamId: e.target.value })} data-testid="register-team">
              <option value="">— Select team —</option>
              {teamList.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="row">
        <Field label="Password"><input className="input" type="password" value={form.password} onChange={e => set({ password: e.target.value })} data-testid="register-password" /></Field>
        <Field label="Confirm Password"><input className="input" type="password" value={form.confirm} onChange={e => set({ confirm: e.target.value })} data-testid="register-confirm" /></Field>
      </div>
      <button className="btn full success" onClick={submit} disabled={busy} data-testid="register-submit">Register</button>
    </div>
  );
}

function EditProfile({ teams, players }) {
  const known = useKnownPlayers(teams, players);
  const teamList = Object.values(teams || {}).sort((a, b) => (a.gradient || 0) - (b.gradient || 0));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [verified, setVerified] = useState(false);
  const [authPw, setAuthPw] = useState('');
  const [form, setForm] = useState({ email: '', phone: '', membership: 'team', teamId: '', password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return known.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [query, known]);

  const selected = known.find(p => p.id === selectedId);
  const record = players?.[selectedId];
  const needsPassword = !!record?.passwordHash; // claimed profiles require the password to edit

  const choose = (p) => {
    setSelectedId(p.id);
    setVerified(false);
    setAuthPw('');
    setMsg('');
    const rec = players?.[p.id];
    setForm({
      email: rec?.email || '',
      phone: rec?.phone || '',
      membership: rec?.membershipType || (p.teamId ? 'team' : 'individual'),
      teamId: rec?.teamId || p.teamId || '',
      password: '', confirm: ''
    });
  };

  const verify = async () => {
    setMsg('');
    if (await verifyPassword(authPw, record?.passwordHash)) {
      setVerified(true);
    } else {
      setMsg('Incorrect password.');
    }
  };

  const save = async () => {
    setMsg('');
    if (!isValidEmail(form.email)) return setMsg('Enter a valid email.');
    if (!isValidPhone(form.phone)) return setMsg('Enter a valid phone number.');
    if (form.membership === 'team' && !form.teamId) return setMsg('Choose your team.');
    if (form.password && form.password.length < 4) return setMsg('Password must be at least 4 characters.');
    if (form.password && form.password !== form.confirm) return setMsg('Passwords do not match.');
    if (!needsPassword && !form.password) return setMsg('Set a password to claim this profile.');

    try {
      setBusy(true);
      const update = {
        id: selectedId,
        name: selected?.name || record?.name || '',
        email: form.email.trim(),
        phone: form.phone.trim(),
        membershipType: form.membership,
        teamId: form.membership === 'team' ? form.teamId : '',
        updatedAt: Date.now()
      };
      if (form.password) update.passwordHash = await hashPassword(form.password);
      if (!record?.createdAt) update.createdAt = Date.now();
      await playersRepo().upsert(selectedId, update);
      setMsg('✅ Profile saved.');
      setForm(prev => ({ ...prev, password: '', confirm: '' }));
    } catch (e) {
      setMsg('Save failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const canEdit = !needsPassword || verified;

  return (
    <div className="card" data-testid="register-edit">
      <h2>Find / Edit My Profile</h2>
      <p className="hint">Search your name to claim an existing roster spot or update your details, password, email and phone.</p>
      {msg && <div className={msg.startsWith('✅') ? 'success-box' : 'error-box'}>{msg}</div>}

      <Field label="Search your name">
        <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Type at least 2 letters" data-testid="register-search" />
      </Field>
      {query && matches.length === 0 && <p className="muted">No matching players. Use New Registration above.</p>}
      {matches.length > 0 && !selectedId && (
        <div style={{ display: 'grid', gap: '.3rem', marginBottom: '.5rem' }}>
          {matches.map(p => (
            <button key={p.id} type="button" className="btn small ghost" onClick={() => choose(p)} data-testid={`register-pick-${p.id}`} style={{ justifyContent: 'space-between', textAlign: 'left' }}>
              {p.name} {p.teamName ? `· ${p.abbreviation || p.teamName}` : ''} {p.registered ? (p.hasPassword ? '· 🔒 claimed' : '· unclaimed') : '· roster'}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
            <strong>{selected.name}</strong>
            <button type="button" className="btn small ghost" onClick={() => { setSelectedId(''); setVerified(false); }}>Change</button>
          </div>

          {needsPassword && !verified ? (
            <>
              <Field label="Enter your password to edit">
                <input className="input" type="password" value={authPw} onChange={e => setAuthPw(e.target.value)} data-testid="register-verify-pw" />
              </Field>
              <button className="btn full" onClick={verify} data-testid="register-verify-btn">Verify</button>
            </>
          ) : (
            <>
              {!needsPassword && <p className="hint">This roster player isn't claimed yet — set a password to claim it.</p>}
              <div className="row">
                <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="register-edit-email" /></Field>
                <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="register-edit-phone" /></Field>
              </div>
              <div className="row">
                <Field label="Membership">
                  <select className="select" value={form.membership} onChange={e => setForm(f => ({ ...f, membership: e.target.value }))}>
                    {MEMBERSHIP_TYPES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
                {form.membership === 'team' && (
                  <Field label="Team">
                    <select className="select" value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                      <option value="">— Select team —</option>
                      {teamList.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}
                    </select>
                  </Field>
                )}
              </div>
              <div className="row">
                <Field label={needsPassword ? 'New Password (optional)' : 'Set Password'}><input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="register-edit-password" /></Field>
                <Field label="Confirm Password"><input className="input" type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} /></Field>
              </div>
              <button className="btn full success" onClick={save} disabled={busy || !canEdit} data-testid="register-edit-save">Save Profile</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Register({ teams, players }) {
  const [tab, setTab] = useState('new');
  const navigate = useNavigate();
  return (
    <main className="container" data-testid="register-page">
      <div className="page-title">
        <h1>Player Registration</h1>
        <p>Register to join a season, or manage your existing profile, password and contact details.</p>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')} data-testid="register-tab-new">New Registration</button>
        <button className={`tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')} data-testid="register-tab-edit">Find / Edit My Profile</button>
      </div>
      {tab === 'new' ? <NewRegistration teams={teams} players={players} /> : <EditProfile teams={teams} players={players} />}
      <button className="btn ghost full" style={{ marginTop: '.6rem' }} onClick={() => navigate('/')}>Back to Home</button>
    </main>
  );
}
