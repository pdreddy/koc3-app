import React, { useMemo, useState } from 'react';

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function weekdayShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function MatchRow({ m, t1, t2, isCompleted }) {
  return (
    <div data-testid={`schedule-match-${m.id}`} style={{
      display: 'flex', gap: '.5rem', alignItems: 'center',
      background: isCompleted ? '#ecfdf5' : '#f8fafc',
      borderLeft: `3px solid ${isCompleted ? '#10b981' : (m.group === 'A' ? '#2563eb' : '#d97706')}`,
      borderRadius: 8, padding: '.55rem .65rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: 6, padding: '.25rem .4rem',
        minWidth: 60, textAlign: 'center',
        color: m.group === 'A' ? '#2563eb' : '#d97706',
        fontWeight: 900, fontSize: '.72rem', lineHeight: 1.2
      }}>
        <div>{weekdayShort(m.date)}</div>
        <div style={{ color: 'var(--ink)', fontSize: '.7rem', marginTop: 1 }}>{m.time}</div>
      </div>
      <div style={{ flex: 1, fontSize: '.82rem', lineHeight: 1.3 }}>
        <div style={{ fontWeight: 800 }}>{t1 ? `${t1.name}` : '?'} <span className="muted" style={{ fontWeight: 600, fontSize: '.72rem' }}>({t1?.abbreviation || '?'})</span></div>
        <div className="muted" style={{ fontWeight: 800, fontSize: '.7rem', margin: '.05rem 0' }}>vs</div>
        <div style={{ fontWeight: 800 }}>{t2 ? `${t2.name}` : '?'} <span className="muted" style={{ fontWeight: 600, fontSize: '.72rem' }}>({t2?.abbreviation || '?'})</span></div>
      </div>
      {isCompleted && <span className="tag win" style={{ fontSize: '.65rem' }}>✓</span>}
    </div>
  );
}

export default function Schedule({ teams, schedule }) {
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');

  const scheduleItems = useMemo(() => Object.values(schedule || {}), [schedule]);
  const bufferItems = useMemo(() => scheduleItems.filter(item => item?.type === 'buffer'), [scheduleItems]);
  const matchList = useMemo(() => scheduleItems.filter(item => item?.type !== 'buffer'), [scheduleItems]);

  const teamOptions = useMemo(() =>
    Object.values(teams || {})
      .filter(t => filterGroup === 'all' || t.group === filterGroup)
      .sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.groupOrder || 0) - (b.groupOrder || 0) || (a.gradient || 0) - (b.gradient || 0))
  , [teams, filterGroup]);

  // Group by round
  const rounds = useMemo(() => {
    const map = {};
    matchList.forEach(m => {
      const key = `${m.round}-${m.date}`;
      if (!map[key]) map[key] = { round: m.round, date: m.date, items: [] };
      map[key].items.push(m);
    });
    return Object.values(map).sort((a, b) => (a.round - b.round) || a.date.localeCompare(b.date));
  }, [matchList]);

  const timeline = useMemo(() => {
    const bufferCards = filterGroup === 'all' && filterTeam === 'all'
      ? bufferItems.map(item => ({ type: 'buffer', date: item.date, id: item.id, item }))
      : [];
    return [
      ...rounds.map(round => ({ type: 'round', date: round.date, id: `${round.round}-${round.date}`, round })),
      ...bufferCards
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'buffer' ? -1 : 1));
  }, [bufferItems, filterGroup, filterTeam, rounds]);

  if (matchList.length === 0) {
    return (
      <main className="container">
        <div className="page-title">
          <h1>Schedule</h1>
          <p>Fixtures load from Firebase — auto-seeded on first launch.</p>
        </div>
        <div className="card center muted" data-testid="schedule-empty">No schedule yet. Sign in as admin to build one.</div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="page-title">
        <h1>Schedule</h1>
        <p>7 rounds · Group A Saturdays · Group B Sundays · July 4 buffer week</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Group</div>
            <select className="select" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setFilterTeam('all'); }} data-testid="schedule-group-filter">
              <option value="all">All</option>
              <option value="A">Group A</option>
              <option value="B">Group B</option>
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <div className="field-label">Team</div>
            <select className="select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)} data-testid="schedule-team-filter">
              <option value="all">All Teams</option>
              {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {timeline.map((entry) => {
        if (entry.type === 'buffer') {
          const item = entry.item;
          return (
            <div className="card center muted" key={item.id} data-testid="schedule-buffer-week">
              <strong>{item.title || 'Buffer week'}</strong>
              <div>{formatDate(item.date)}</div>
            </div>
          );
        }

        const r = entry.round;
        const visible = r.items.filter(m => {
          if (filterGroup !== 'all' && m.group !== filterGroup) return false;
          if (filterTeam !== 'all' && m.team1Id !== filterTeam && m.team2Id !== filterTeam) return false;
          return true;
        }).sort((a, b) => (a.group.localeCompare(b.group)) || a.time.localeCompare(b.time));
        if (visible.length === 0) return null;

        return (
          <div className="card" key={`${r.round}-${r.date}`} data-testid={`schedule-round-${r.round}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.55rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--ring)' }}>
              <span className="tag" style={{ background: 'linear-gradient(135deg,var(--bg1),var(--bg2))', color: '#fff', padding: '.25rem .6rem', fontSize: '.72rem' }}>Round {r.round}</span>
              <span className="muted" style={{ fontWeight: 700, fontSize: '.82rem' }}>{formatDate(r.date)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {visible.map(m => (
                <div key={m.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', margin: '.1rem 0 .2rem' }}>
                    <span className="tag" style={{
                      fontSize: '.65rem',
                      background: m.group === 'A' ? '#dbeafe' : '#fed7aa',
                      color: m.group === 'A' ? '#1e3a8a' : '#9a3412'
                    }}>Group {m.group}</span>
                    {m.status === 'completed' && <span className="tag win" style={{ fontSize: '.65rem' }}>Played</span>}
                    {m.status === 'cancelled' && <span className="tag lose" style={{ fontSize: '.65rem' }}>Cancelled</span>}
                  </div>
                  <MatchRow m={m} t1={teams[m.team1Id]} t2={teams[m.team2Id]} isCompleted={m.status === 'completed'} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}
