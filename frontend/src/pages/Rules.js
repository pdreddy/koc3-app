import React from 'react';

const ruleCards = [
  {
    num: '01', icon: '🏃', title: 'Player Participation (Round-Robin)',
    items: [
      ['👤', 'Regular Season', 'Each player must play a minimum of 3 matches and a maximum of 6 matches in the regular season.'],
      ['🎾', 'Singles Cap', 'Each player can play a maximum of 2 singles matches.'],
      ['🤝', 'Same Doubles Pair', 'The same doubles pair can partner together a maximum of 3 times — 3 match days or 6 matches.']
    ]
  },
  {
    num: '02', icon: '📝', title: 'Lines',
    items: [
      ['🗓️', 'Sunday Deadline', 'Lines are due every Sunday by 9 PM — mandatory, even if you play later in the week.'],
      ['😄', 'Missed Deadline', 'Miss it? Vinod, Uma, or I will set your lines. Yes, that includes their own teams.']
    ]
  },
  {
    num: '03', icon: '📅', title: 'Scheduling',
    items: [
      ['🤝', 'Mutual Agreement', "Postpone only by mutual agreement. The current week's match comes first."],
      ['✅', 'Before RR Ends', 'All postponed matches must be completed before the round-robin ends.'],
      ['🌦️', 'Buffer Week', 'There is an extra buffer week at the end of round-robin for weather make-ups.']
    ]
  },
  {
    num: '04', icon: '📊', title: 'Scores',
    items: [
      ['🏆', 'Winning Captain', 'Winning captain posts the score by the immediate Monday EOD — strictly enforced.'],
      ['⏱️', 'Split Days', 'Splitting matches across days? Scores are still all due by that Monday.']
    ]
  },
  {
    num: '05', icon: '🌧️', title: 'Weather',
    items: [
      ['🌧️', 'Full Washout', 'A full washout gives teams a window to reschedule, play, and post.'],
      ['0️⃣', 'No Completion', "Can't make it happen? Zero points for that fixture."]
    ]
  },
  {
    num: '06', icon: '⚠️', title: 'Postponement (Non-Weather)',
    items: [
      ['🚫', 'No Mutual Agreement', 'Postpone or no-show for a non-weather reason without mutual agreement? The opponent can raise it.'],
      ['📉', 'Penalty', 'Penalty: 4 games (or a set) deducted — and the match still gets played on a later day.']
    ]
  },
  {
    num: '07', icon: '🏆', title: 'Playoffs',
    items: [
      ['7️⃣', 'Roster Usage', 'No 3–6 limit here — all 7 players play in semis and finals.'],
      ['🗓️', 'Windows', 'Semifinals: 5-day window. Finals: 10-day window.'],
      ['☀️', 'Extra Buffer', 'Extra buffer is included for summer and Labor Day weekend.']
    ]
  }
];
function RuleItem({ item }) {
  const [icon, label, value] = item;
  return (
    <div className="rl-item">
      <span className="rl-ic" aria-hidden="true">{icon}</span>
      <div><div className="rl-lbl">{label}</div><div className="rl-val">{value}</div></div>
    </div>
  );
}

function RuleCard({ card }) {
  return (
    <article id={`rule-${card.num}`} className="card rl-card" data-testid={`rule-card-${card.num}`}>
      <div className="rl-card-head"><span className="rl-num">{card.num}</span><span className="rl-chip" aria-hidden="true">{card.icon}</span><h3>{card.title}</h3></div>
      {card.items?.map(item => <RuleItem key={`${card.num}-${item[1]}`} item={item} />)}
    </article>
  );
}

export default function Rules() {
  return (
    <main className="container" data-testid="rules-page">
      <div className="page-title">
        <h1>Rules &amp; Format</h1>
        <p>Welcome to the season! Quick rundown before Week 1 — participation, lines, scores, weather and playoffs.</p>
      </div>

      <div className="rl-sec-head"><h2>The Rules</h2><div className="ln" /></div>
      <section className="rl-grid">{ruleCards.map(card => <RuleCard key={card.num} card={card} />)}</section>

      <div className="rl-sec-head"><h2>Remember</h2><div className="ln" /></div>
      <section className="rl-flow rl-reminders">
        <div className="rl-step"><b>🗓️</b><strong>Sunday 9 PM</strong><small>Lines are due.</small></div>
        <div className="rl-step"><b>📊</b><strong>Monday EOD</strong><small>Scores are due.</small></div>
      </section>

      <div className="rl-motto">Let's go! 🎾</div>
    </main>
  );
}
