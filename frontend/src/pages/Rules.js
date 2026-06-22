import React from 'react';

const ruleCards = [
  {
    num: '01', color: 'var(--rules-c1)', icon: '✅', title: 'Player Eligibility Rules',
    items: [
      ['📅', 'Total Match Days', 'A player may participate in a maximum of 5 match days during Round Robin.'],
      ['🎾', 'Singles Day', '1 singles match. A player can play a maximum of 2 singles days.'],
      ['👥', 'Doubles Day', '2 matches: Doubles + Reverse Doubles. If selected for doubles, the player must play both.'],
      ['🔁', 'Doubles Days', 'No fixed doubles-day limit as long as total match days stay at 5 or below.'],
      ['🤝', 'Same Partner', 'The same doubles pair can partner together for a maximum of 3 match days.'],
      ['🧾', 'Score Validation', 'Before lineup or score submission: totalMatchDays ≤ 5, singlesDays ≤ 2, samePartnerDays ≤ 3, and every player belongs to the selected team.']
    ],
    flag: ['warn', '⚠️', 'Not allowed: 3 singles days, more than 5 total match days, or same doubles pair for 4 match days.']
  },
  {
    num: '02', color: 'var(--rules-c2)', icon: '📋', title: 'Valid Eligibility Examples',
    items: [
      ['✅', '5 Doubles Days', 'Allowed.'],
      ['✅', '4 Doubles + 1 Singles', 'Allowed.'],
      ['✅', '3 Doubles + 2 Singles', 'Allowed.'],
      ['✅', '2 Doubles + 2 Singles', 'Allowed.'],
      ['✅', '1 Doubles + 2 Singles', 'Allowed.'],
      ['❌', '2 Singles + 4 Doubles', 'Not allowed because it is 6 total match days.']
    ]
  },
  {
    num: '03', color: 'var(--rules-c3)', icon: '🏆', title: 'Format, Scoring & Match Play',
    groups: [
      ['Format & Calendar', [['🏟️', 'Format', '16 Teams • Round Robin.'], ['🗓️', 'Schedule', 'Group A Saturdays, Group B Sundays, all at 7:15 PM.'], ['📆', 'Buffer', 'July 4 weekend is a buffer week.']]],
      ['Match Format', [['🧍', 'Singles', 'Best of 5 mini-sets.'], ['👥', 'Doubles', 'Best of 3 sets. At 3–3, a 7-point tiebreaker. The 3rd set is a 15-point tiebreaker.']]],
      ['Scoring', [['✅', 'Win', 'Win 3 of 5 lines on a match day → 1 point.'], ['❌', 'Loss', 'Loss → 0 points.'], ['📊', 'Tiebreak', 'Points → Sets → Games → Head-to-Head.']]]
    ]
  },
  {
    num: '04', color: 'var(--rules-c4)', icon: '📅', title: 'Scheduling',
    items: [
      ['🕒', 'Match Days', 'Saturday & Sunday at 7:15 PM.'],
      ['🤝', 'Weekday Play', "Captains may choose a weekday if both teams' players are available."],
      ['📝', 'Share Lineups', "Both captains must share lines in the captains' group to avoid unwanted situations."],
      ['⏱️', 'Missed Lineups', "If you miss the schedule and don't share lineups by 9:00 PM on the scheduled day."],
      ['🔁', 'Mutual Reschedule Priority', "Current week's matches take priority. Backlog can be played later."],
      ['🚫', 'Change Deadline', 'No changes after the scheduled day.'],
      ['📣', 'Score Reporting', 'If both teams fail to post scores before Sunday morning → 0 points for both. Winning captain must post.']
    ],
    flag: ['warn', '⚠️', 'No-show = forfeit.']
  },
  {
    num: '05', color: 'var(--rules-c5)', icon: '📋', title: 'Match Day Protocol',
    solo: ['Arrive 15 minutes early.', 'Exchange lineups before play.', 'No lineup changes once started.', 'All lines must finish the same day.']
  },
  {
    num: '06', color: 'var(--rules-c6)', icon: '🏥', title: 'Injuries',
    items: [
      ['📃', 'League (Round-Robin)', 'Replace with a similar UTR player or .5 lower level; requires Committee approval.'],
      ['🏅', 'Playoffs', 'Only if 2+ players are ruled out; requires Committee approval.']
    ]
  },
  {
    num: '07', color: 'var(--rules-c7)', icon: '⚡', title: 'No-Ad Scoring',
    solo: ['Deciding point at deuce.', 'Receiver chooses side (no 2-point advantage).']
  },
  {
    num: '08', color: 'var(--rules-c8)', icon: '🤝', title: 'Conduct & Fair Play',
    solo: ['Players make their own line calls.', 'Disputes → Committee decision.', 'Respectful behavior is mandatory.'],
    flag: ['warn', '⚠️', 'Misconduct = penalty.']
  }
];

function RuleItem({ item }) {
  const [icon, label, value] = item;
  return (
    <div className="rules-item">
      <span className="rules-ic">{icon}</span>
      <div><div className="rules-lbl">{label}</div><div className="rules-val">{value}</div></div>
    </div>
  );
}

function RuleCard({ card, idx }) {
  return (
    <article id={`rule-${card.num}`} className="rules-card" style={{ '--rule-color': card.color, animationDelay: `${(idx + 1) * 0.04}s` }}>
      <div className="rules-card-top"><span className="rules-num">{card.num}</span><span className="rules-chip">{card.icon}</span><span className="rules-title">{card.title}</span></div><div className="rules-card-watermark">{card.num}</div>
      {card.items?.map((item) => <RuleItem key={`${card.num}-${item[1]}`} item={item} />)}
      {card.groups?.map(([name, items]) => (
        <div key={name}>
          <div className="rules-sub">{name}</div>
          {items.map(item => <RuleItem key={`${name}-${item[1]}`} item={item} />)}
        </div>
      ))}
      {card.solo?.map((value) => <div className="rules-item solo" key={value}><span className="rules-ic">🎾</span><div className="rules-val">{value}</div></div>)}
      {card.flag && <div className={`rules-flag ${card.flag[0]}`}><span>{card.flag[1]}</span><span>{card.flag[2]}</span></div>}
    </article>
  );
}

export default function Rules() {
  return (
    <main className="rules-wrap">
      <section className="rules-hero">
        <div className="rules-hero-text">
          <span className="rules-eyebrow">● KOC Season 3 — The Rulebook</span>
          <h1><span>Rules &amp;</span><em>Format</em></h1>
          <p>Everything captains and players need: eligibility limits, scoring, scheduling, and the road to the playoffs.</p>
          <div className="rules-energy" />
        </div>
        <div className="rules-visual" aria-hidden="true"><div className="rules-orbit" /><div className="rules-ball" /><div className="rules-racket" /></div>
        <div className="rules-stats">
          <div className="rules-stat"><b>16</b><small>Teams</small></div>
          <div className="rules-stat"><b>RR</b><small>Round Robin</small></div>
          <div className="rules-stat"><b>7:15</b><small>PM Matches</small></div>
          <div className="rules-stat"><b>Bo5</b><small>Singles Format</small></div>
        </div>
      </section>

      <nav className="rules-toc" aria-label="Rules sections">
        {ruleCards.map(card => <a key={card.num} href={`#rule-${card.num}`}><span>{card.num}</span>{card.title}</a>)}
      </nav>

      <div className="rules-sec-head"><h2>The Rules</h2><div className="rules-line" /></div>
      <section className="rules-grid">{ruleCards.map((card, idx) => <RuleCard key={card.num} card={card} idx={idx} />)}</section>

      <section className="rules-flow-card">
        <div><b>1</b><span>Share lineup</span><small>Captains post lines before play.</small></div>
        <div><b>2</b><span>Play 5 lines</span><small>Singles, doubles and reverse doubles.</small></div>
        <div><b>3</b><span>Post scores</span><small>Winning captain reports before Sunday morning.</small></div>
        <div><b>4</b><span>Standings update</span><small>Points, sets, games and head-to-head decide rank.</small></div>
      </section>

      <div className="rules-sec-head"><h2>Playoffs</h2><div className="rules-line" /></div>
      <section className="rules-bracket">
        <p><strong>Top 4 from both groups qualify.</strong> Quarterfinal crossovers pit each group's high seeds against the other group's lowest.</p>
        <div className="rules-groups">
          <div><h3>Quarterfinals — Top half</h3><div className="rules-qf"><span>QF1</span><b>A1 <i>vs</i> B4</b></div><div className="rules-qf"><span>QF2</span><b>A2 <i>vs</i> B3</b></div></div>
          <div><h3>Quarterfinals — Bottom half</h3><div className="rules-qf"><span>QF3</span><b>A3 <i>vs</i> B2</b></div><div className="rules-qf"><span>QF4</span><b>A4 <i>vs</i> B1</b></div></div>
        </div>
        <h3>Semifinals</h3>
        <div className="rules-groups"><div className="rules-qf"><span>SF1</span><b>QF1 <i>vs</i> QF4</b></div><div className="rules-qf"><span>SF2</span><b>QF2 <i>vs</i> QF3</b></div></div>
      </section>
      <div className="rules-motto">Play fair · Win big · Repeat · Celebrate 🎾</div>
    </main>
  );
}
