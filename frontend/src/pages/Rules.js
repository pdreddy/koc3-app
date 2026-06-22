import React from 'react';

const ruleCards = [
  {
    num: '01', icon: '✅', title: 'Player Eligibility Rules',
    items: [
      ['📅', 'Total Match Days', 'A player may participate in a maximum of 5 match days during Round Robin.'],
      ['🎾', 'Singles Day', '1 singles match. A player can play a maximum of 2 singles days.'],
      ['👥', 'Doubles Day', '2 matches: Doubles + Reverse Doubles. If selected for doubles, the player must play both.'],
      ['🔁', 'Doubles Days', 'No fixed doubles-day limit as long as total match days stay at 5 or below.'],
      ['🤝', 'Same Partner', 'The same doubles pair can partner together for a maximum of 3 match days.']
    ],
    flag: ['warn', '⚠️', 'Not allowed: 3 singles days, more than 5 total match days, or same doubles pair for 4 match days.']
  },
  {
    num: '02', icon: '📋', title: 'Valid Eligibility Examples',
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
    num: '03', icon: '🏆', title: 'Format, Scoring & Match Play',
    groups: [
      ['Format & Calendar', [['🏟️', 'Format', '16 Teams • Round Robin.'], ['🗓️', 'Schedule', 'Group A Saturdays, Group B Sundays, all at 7:15 PM.'], ['📆', 'Buffer', 'July 4 weekend is a buffer week.']]],
      ['Match Format', [['🧍', 'Singles', 'Best of 5 mini-sets.'], ['👥', 'Doubles', 'Best of 3 sets. At 3–3, a 7-point tiebreaker. The 3rd set is a 15-point tiebreaker.']]],
      ['Scoring', [['✅', 'Win', 'Win 3 of 5 lines on a match day → 1 point.'], ['❌', 'Loss', 'Loss → 0 points.'], ['📊', 'Tiebreak', 'Points → Sets → Games → Head-to-Head.']]]
    ]
  },
  {
    num: '04', icon: '📅', title: 'Scheduling',
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
    num: '05', icon: '📋', title: 'Match Day Protocol',
    solo: ['Arrive 15 minutes early.', 'Exchange lineups before play.', 'No lineup changes once started.', 'All lines must finish the same day.']
  },
  {
    num: '06', icon: '🏥', title: 'Injuries',
    items: [
      ['📃', 'League (Round-Robin)', 'Replace with a similar UTR player or .5 lower level; requires Committee approval.'],
      ['🏅', 'Playoffs', 'Only if 2+ players are ruled out; requires Committee approval.']
    ]
  },
  {
    num: '07', icon: '⚡', title: 'No-Ad Scoring',
    solo: ['Deciding point at deuce.', 'Receiver chooses side (no 2-point advantage).']
  },
  {
    num: '08', icon: '🤝', title: 'Conduct & Fair Play',
    solo: ['Players make their own line calls.', 'Disputes → Committee decision.', 'Respectful behavior is mandatory.'],
    flag: ['warn', '⚠️', 'Misconduct = penalty.']
  }
];

const MATCH_FLOW = [
  ['1', 'Share lineup', 'Captains post lines before play.'],
  ['2', 'Play 5 lines', 'Singles, doubles and reverse doubles.'],
  ['3', 'Post scores', 'Winning captain reports before Sunday morning.'],
  ['4', 'Standings update', 'Points, sets, games and head-to-head decide rank.']
];

function RuleItem({ item }) {
  const [icon, label, value] = item;
  return (
    <div className="rl-item">
      <span className="rl-ic" aria-hidden="true">{icon}</span>
      <div>
        <div className="rl-lbl">{label}</div>
        <div className="rl-val">{value}</div>
      </div>
    </div>
  );
}

function RuleCard({ card }) {
  return (
    <article id={`rule-${card.num}`} className="card rl-card" data-testid={`rule-card-${card.num}`}>
      <div className="rl-card-head">
        <span className="rl-num">{card.num}</span>
        <span className="rl-chip" aria-hidden="true">{card.icon}</span>
        <h3>{card.title}</h3>
      </div>

      {card.items?.map((item) => <RuleItem key={`${card.num}-${item[1]}`} item={item} />)}

      {card.groups?.map(([name, items]) => (
        <div key={name}>
          <div className="rl-sub">{name}</div>
          {items.map(item => <RuleItem key={`${name}-${item[1]}`} item={item} />)}
        </div>
      ))}

      {card.solo?.map((value) => (
        <div className="rl-item solo" key={value}>
          <span className="rl-ic" aria-hidden="true">🎾</span>
          <div className="rl-val">{value}</div>
        </div>
      ))}

      {card.flag && (
        <div className={`rl-flag ${card.flag[0]}`}>
          <span aria-hidden="true">{card.flag[1]}</span>
          <span>{card.flag[2]}</span>
        </div>
      )}
    </article>
  );
}

export default function Rules() {
  return (
    <main className="container" data-testid="rules-page">
      <div className="page-title">
        <h1>Rules &amp; Format</h1>
        <p>Everything captains and players need — eligibility, scoring, scheduling and the road to the playoffs.</p>
      </div>

      <div className="rl-sec-head"><h2>The Rules</h2><div className="ln" /></div>
      <section className="rl-grid">
        {ruleCards.map((card) => <RuleCard key={card.num} card={card} />)}
      </section>

      <div className="rl-sec-head"><h2>How a Match Day Works</h2><div className="ln" /></div>
      <section className="rl-flow">
        {MATCH_FLOW.map(([n, title, desc]) => (
          <div className="rl-step" key={n}>
            <b>{n}</b>
            <strong>{title}</strong>
            <small>{desc}</small>
          </div>
        ))}
      </section>

      <div className="rl-sec-head"><h2>Playoffs</h2><div className="ln" /></div>
      <section className="card">
        <p className="rl-bracket-intro">
          <strong>Top 4 from both groups qualify.</strong> Quarterfinal crossovers pit each group's high seeds against the other group's lowest.
        </p>
        <div className="rl-cross">
          <div>
            <div className="rl-bracket-sub">Quarterfinals — Top half</div>
            <div className="rl-qf"><span>QF1</span><b>A1 <i>vs</i> B4</b></div>
            <div className="rl-qf"><span>QF2</span><b>A2 <i>vs</i> B3</b></div>
          </div>
          <div>
            <div className="rl-bracket-sub">Quarterfinals — Bottom half</div>
            <div className="rl-qf"><span>QF3</span><b>A3 <i>vs</i> B2</b></div>
            <div className="rl-qf"><span>QF4</span><b>A4 <i>vs</i> B1</b></div>
          </div>
        </div>
        <div className="rl-bracket-sub">Semifinals</div>
        <div className="rl-cross">
          <div className="rl-qf"><span>SF1</span><b>QF1 <i>vs</i> QF4</b></div>
          <div className="rl-qf"><span>SF2</span><b>QF2 <i>vs</i> QF3</b></div>
        </div>
      </section>

      <div className="rl-motto">Play fair · Win big · Repeat · Celebrate 🎾</div>
    </main>
  );
}
