import React from 'react';

const ruleCards = [
  {
    num: '01', color: 'var(--rules-c1)', icon: '⚙️', title: 'Player Match Limits',
    items: [
      ['👥', 'Doubles Combo (RR only)', 'Max 3 days / 6 matches. Any Player1–Player2 pairing is capped at 3 days.'],
      ['🎾', 'Singles (RR only)', 'A player can play singles a max of 2 days.'],
      ['📊', 'Overall (RR only)', 'Max 5 days total across Singles + Doubles.']
    ],
    flag: ['warn', '⚠️', 'Violation: zero points for that match. Caps apply to round-robin only.']
  },
  {
    num: '02', color: 'var(--rules-c2)', icon: '🏁', title: 'Competition Rules',
    items: [
      ['👥', 'Team Size', '7 players.'],
      ['❗', 'Minimum Participation', 'Each player must play 3 matches, or the team is ineligible for playoffs.'],
      ['🩺', 'Injury Replacement', 'Committee call — requires approval from captains & Uma.']
    ]
  },
  {
    num: '03', color: 'var(--rules-c3)', icon: '🏆', title: 'Format, Scoring & Match Play',
    groups: [
      ['Format & Calendar', [['🏟️', 'Format', '16 Teams • Round Robin.'], ['🗓️', 'Duration', 'Jun 30 – Sep 15.'], ['📆', 'Matches / Week', '8 lines per week: 4 Sunday, 4 Saturday.']]],
      ['Match Format', [['🧍', 'Singles', 'Best of 5 mini-sets.'], ['👥', 'Doubles', 'Best of 3 sets. At 3–3, a 7-point tiebreaker. The 3rd set is a 15-point tiebreaker.']]],
      ['Scoring', [['✅', 'Win', 'Win 3 of 5 lines on a match day → 1 point.'], ['❌', 'Loss', 'Loss → 0 points.'], ['📊', 'Tiebreak', 'Points → Sets → Games → Head-to-Head.']]]
    ]
  },
  {
    num: '04', color: 'var(--rules-c4)', icon: '📅', title: 'Scheduling',
    items: [
      ['🕒', 'Match Days', 'Sunday & Saturday.'],
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
    <article className="rules-card" style={{ '--rule-color': card.color, animationDelay: `${(idx + 1) * 0.04}s` }}>
      <div className="rules-card-top"><span className="rules-num">{card.num}</span><span className="rules-chip">{card.icon}</span><span className="rules-title">{card.title}</span></div>
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
          <span className="rules-eyebrow">● KOC Season 2 — The Rulebook</span>
          <h1><span>Rules &amp;</span><em>Format</em></h1>
          <p>Everything captains and players need: match limits, scoring, scheduling, and the road to the playoffs.</p>
          <div className="rules-energy" />
        </div>
        <div className="rules-visual" aria-hidden="true"><div className="rules-ball" /></div>
        <div className="rules-stats">
          <div className="rules-stat"><b>16</b><small>Teams</small></div>
          <div className="rules-stat"><b>RR</b><small>Round Robin</small></div>
          <div className="rules-stat"><b>Jun 30</b><small>→ Sep 15</small></div>
          <div className="rules-stat"><b>Bo5</b><small>Singles Format</small></div>
        </div>
      </section>

      <div className="rules-sec-head"><h2>The Rules</h2><div className="rules-line" /></div>
      <section className="rules-grid">{ruleCards.map((card, idx) => <RuleCard key={card.num} card={card} idx={idx} />)}</section>

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
