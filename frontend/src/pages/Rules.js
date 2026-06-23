import React from 'react';

const ruleCards = [
  {
    num: '01', color: 'var(--rules-c1)', icon: '👥', title: 'Player Participation',
    items: [
      ['✅', 'Regular Season Range', 'Each player must play at least 3 and at most 6 matches during the round-robin.'],
      ['🎾', 'Singles Cap', 'Maximum 2 singles matches per player in the round-robin.'],
      ['🤝', 'Doubles Pair Cap', 'The same doubles pair can play together a maximum of 3 match days, which equals 6 doubles/reverse-doubles matches.']
    ],
    flag: ['warn', '📌', 'These limits apply to the round-robin only; playoff eligibility is handled separately.']
  },
  {
    num: '02', color: 'var(--rules-c2)', icon: '📝', title: 'Lines',
    items: [
      ['🗓️', 'Deadline', 'Lines are due every Sunday by 9 PM — mandatory even if the fixture is played later in the week.'],
      ['⚠️', 'Missed Deadline', 'If lines are not submitted on time, Vinod, Uma, or Damureddi will set the lines.'],
      ['😄', 'Same Rule for Everyone', 'This applies even to their own teams.']
    ]
  },
  {
    num: '03', color: 'var(--rules-c3)', icon: '📅', title: 'Scheduling',
    items: [
      ['🤝', 'Mutual Agreement', 'Postpone only when both captains agree.'],
      ['🔥', 'Current Week First', "The current week's match always takes priority over older make-ups."],
      ['⏳', 'Before RR Ends', 'All postponed matches must be completed before the round-robin ends.'],
      ['🌦️', 'Buffer Week', 'An extra buffer week is available at the end of the round-robin for weather make-ups.']
    ]
  },
  {
    num: '04', color: 'var(--rules-c4)', icon: '📊', title: 'Scores',
    items: [
      ['🏆', 'Who Posts', 'The winning captain posts the score.'],
      ['⏰', 'Deadline', 'Scores are due by the immediate Monday EOD — strictly enforced.'],
      ['🧩', 'Split Days', 'If lines are split across days, all scores are still due by that Monday.']
    ]
  },
  {
    num: '05', color: 'var(--rules-c5)', icon: '🌧️', title: 'Weather',
    items: [
      ['🌧️', 'Full Washout', 'A full washout creates a window to reschedule, play, and post the fixture.'],
      ['0️⃣', 'No Completion', 'If teams cannot make it happen, the fixture receives zero points.']
    ]
  },
  {
    num: '06', color: 'var(--rules-c6)', icon: '🚫', title: 'Non-Weather Postponement',
    items: [
      ['📣', 'Opponent Can Raise', 'If a team postpones or no-shows for a non-weather reason without mutual agreement, the opponent can raise it.'],
      ['➖', 'Penalty', 'Penalty is 4 games, or a set, deducted from the offending team.'],
      ['▶️', 'Still Played', 'The match still gets played on a later day.']
    ],
    flag: ['warn', '⚠️', 'Non-weather postponements need mutual agreement before the fixture is moved.']
  },
  {
    num: '07', color: 'var(--rules-c7)', icon: '🏆', title: 'Playoffs',
    items: [
      ['7️⃣', 'Roster Use', 'No 3–6 match limit in playoffs — all 7 players play in semis and finals.'],
      ['⏱️', 'Semifinals', 'Semifinals have a 5-day play window.'],
      ['🏁', 'Finals', 'Finals have a 10-day play window.'],
      ['☀️', 'Extra Buffer', 'Extra buffer is included for summer schedules and Labor Day weekend.']
    ]
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
      <section className="rules-hero kickoff-hero">
        <div className="rules-hero-text">
          <span className="rules-eyebrow">🏆 League Kickoff — Rules</span>
          <h1><span>KOC3 / PPRC</span><em>Season Rules</em></h1>
          <p>Welcome to the season. Quick captain-friendly rundown before Week 1: participation, lines, scheduling, scores, weather, postponements, and playoffs.</p>
          <div className="rules-energy" />
        </div>
        <div className="rules-visual" aria-hidden="true"><div className="rules-orbit" /><div className="rules-ball" /><div className="rules-racket" /></div>
        <div className="rules-stats">
          <div className="rules-stat"><b>Sun 9 PM</b><small>Lines Due</small></div>
          <div className="rules-stat"><b>Mon EOD</b><small>Scores Due</small></div>
          <div className="rules-stat"><b>2</b><small>Singles Max</small></div>
          <div className="rules-stat"><b>6</b><small>Max RR Matches</small></div>
        </div>
      </section>

      <section className="rules-reminder" aria-label="Key reminders">
        <div><strong>🗓️ Sunday 9 PM</strong><span>Captains submit lines.</span></div>
        <div><strong>📊 Monday EOD</strong><span>Winning captain posts scores.</span></div>
        <div><strong>🎾 Same Pair</strong><span>Max 3 match days / 6 matches.</span></div>
      </section>

      <nav className="rules-toc" aria-label="Rules sections">
        {ruleCards.map(card => <a key={card.num} href={`#rule-${card.num}`}><span>{card.num}</span>{card.title}</a>)}
      </nav>

      <div className="rules-sec-head"><h2>The Rules</h2><div className="rules-line" /></div>
      <section className="rules-grid">{ruleCards.map((card, idx) => <RuleCard key={card.num} card={card} idx={idx} />)}</section>

      <section className="rules-flow-card">
        <div><b>1</b><span>Submit lines</span><small>Every Sunday by 9 PM.</small></div>
        <div><b>2</b><span>Play current week</span><small>Current fixture takes priority.</small></div>
        <div><b>3</b><span>Post scores</span><small>Winning captain by Monday EOD.</small></div>
        <div><b>4</b><span>Make up weather</span><small>Use the RR buffer week if needed.</small></div>
      </section>

      <div className="rules-sec-head"><h2>Playoff Windows</h2><div className="rules-line" /></div>
      <section className="rules-bracket">
        <p><strong>No 3–6 round-robin participation limit applies in playoffs.</strong> All seven players participate in semifinals and finals.</p>
        <div className="rules-groups">
          <div><h3>Semifinals</h3><div className="rules-qf"><span>Window</span><b>5 days</b></div></div>
          <div><h3>Finals</h3><div className="rules-qf"><span>Window</span><b>10 days</b></div></div>
        </div>
      </section>
      <div className="rules-motto">Let's go! Play fair · Post on time · Compete hard 🎾</div>
    </main>
  );
}
