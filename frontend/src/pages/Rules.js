import React from 'react';

const ruleCards = [
  {
    num: '01', icon: '🏃', title: 'Player Participation', accent: 'blue',
    items: [
      ['👤', 'Regular Season', 'Each player must play a minimum of 3 matches and a maximum of 6 matches in the regular season.'],
      ['🎾', 'Singles Cap', 'Each player can play a maximum of 2 singles matches.'],
      ['🤝', 'Same Doubles Pair', 'The same doubles pair can partner together a maximum of 3 times — 3 match days or 6 matches.']
    ]
  },
  {
    num: '02', icon: '📝', title: 'Lines', accent: 'purple',
    items: [
      ['🗓️', 'Sunday Deadline', 'Lines are due every Sunday by 9 PM — mandatory, even if you play later in the week.'],
      ['😄', 'Missed Deadline', 'Miss it? Vinod, Uma, or I will set your lines. Yes, that includes their own teams.']
    ]
  },
  {
    num: '03', icon: '📅', title: 'Scheduling', accent: 'green',
    items: [
      ['🤝', 'Mutual Agreement', "Postpone only by mutual agreement. The current week's match comes first."],
      ['✅', 'Before Round-Robin Ends', 'All postponed matches must be completed before the round-robin ends.'],
      ['🌦️', 'Buffer Week', 'There is an extra buffer week at the end of round-robin for weather make-ups.']
    ]
  },
  {
    num: '04', icon: '📊', title: 'Scores', accent: 'orange',
    items: [
      ['🏆', 'Winning Captain', 'Winning captain posts the score by the immediate Monday EOD — strictly enforced.'],
      ['⏱️', 'Split Days', 'Splitting matches across days? Scores are still all due by that Monday.']
    ]
  },
  {
    num: '05', icon: '📋', title: 'Match Day Protocol', accent: 'purple',
    bullets: ['Arrive 15 minutes early.', 'Exchange lineups before play.', 'No lineup changes once started.', 'All lines must finish the same day.']
  },
  {
    num: '06', icon: '🏥', title: 'Injuries', accent: 'green',
    items: [
      ['📃', 'League (Round-Robin)', 'Replace with a similar UTR player or .5 lower level; requires Committee approval.'],
      ['🏅', 'Playoffs', 'Only if 2+ players are ruled out; requires Committee approval.']
    ]
  },
  {
    num: '07', icon: '⚡', title: 'No-Ad Scoring', accent: 'blue',
    bullets: ['Deciding point at deuce.', 'Receiver chooses side (no 2-point advantage).']
  },
  {
    num: '08', icon: '🤝', title: 'Conduct & Fair Play', accent: 'orange',
    bullets: ['Players make their own line calls.', 'Disputes → Committee decision.', 'Respectful behavior is mandatory.'],
    note: '⚠️ Misconduct = penalty.'
  },
  {
    num: '09', icon: '🌧️', title: 'Weather', accent: 'blue',
    items: [
      ['🌧️', 'Full Washout', 'A full washout gives teams a window to reschedule, play, and post.'],
      ['0️⃣', 'No Completion', "Can't make it happen? Zero points for that fixture."]
    ]
  },
  {
    num: '10', icon: '⚠️', title: 'Postponement (Non-Weather)', accent: 'orange',
    items: [
      ['🚫', 'No Mutual Agreement', 'Postpone or no-show for a non-weather reason without mutual agreement? The opponent can raise it.'],
      ['📉', 'Penalty', 'Penalty: 4 games (or a set) deducted — and the match still gets played on a later day.']
    ]
  },
  {
    num: '11', icon: '🏆', title: 'Playoffs', accent: 'green',
    items: [
      ['7️⃣', 'Roster Usage', 'No 3–6 limit here — all 7 players play in semis and finals.'],
      ['🗓️', 'Windows', 'Semifinals: 5-day window. Finals: 10-day window.'],
      ['☀️', 'Extra Buffer', 'Extra buffer is included for summer and Labor Day weekend.']
    ]
  }
];

const matchDayFlow = [
  ['1', 'Share Lineup', 'Captains post lines before play.'],
  ['2', 'Play 5 Lines', 'Singles, doubles and reverse doubles.'],
  ['3', 'Post Scores', 'Winning captain reports before Sunday morning.'],
  ['4', 'Standings Update', 'Points, sets, games and head-to-head decide rank.']
];

function RuleDetail({ icon, label, value }) {
  return (
    <div className="rl-dark-detail">
      <span aria-hidden="true">{icon}</span>
      <p><strong>{label}</strong>{value && <small>{value}</small>}</p>
    </div>
  );
}

function RuleCard({ card }) {
  return (
    <article id={`rule-${card.num}`} className={`rl-dark-card ${card.accent}`} data-testid={`rule-card-${card.num}`}>
      <div className="rl-dark-head"><span className="rl-dark-num">{card.num}</span><span className="rl-dark-chip" aria-hidden="true">{card.icon}</span><h3>{card.title}</h3></div>
      <div className="rl-dark-list">
        {card.items?.map(([icon, label, value]) => <RuleDetail key={`${card.num}-${label}`} icon={icon} label={label} value={value} />)}
        {card.bullets?.map(bullet => <div className="rl-dark-item" key={bullet}><span>🎾</span><p>{bullet}</p></div>)}
      </div>
      {card.note && <div className="rl-dark-note">{card.note}</div>}
      <span className="rl-dark-watermark" aria-hidden="true">{card.num}</span>
    </article>
  );
}

export default function Rules() {
  return (
    <main className="container rules-page-shell" data-testid="rules-page">
      <div className="page-title rules-hero">
        <h1>Rules &amp; Format</h1>
        <p>Quick rundown before match day — participation, lineups, scores, weather, injuries, conduct and playoffs.</p>
      </div>

      <div className="rl-sec-head"><h2>The Rules</h2><div className="ln" /></div>
      <section className="rl-grid rules-unified-grid">{ruleCards.map(card => <RuleCard key={card.num} card={card} />)}</section>

      <div className="rl-sec-head"><h2>Match Flow</h2><div className="ln" /></div>
      <section className="rl-match-flow" data-testid="matchday-flow">
        {matchDayFlow.map(([num, title, text]) => (
          <div className="rl-flow-card" key={num}>
            <b>{num}</b><strong>{title}</strong><small>{text}</small>
          </div>
        ))}
      </section>

      <div className="rl-sec-head"><h2>Remember</h2><div className="ln" /></div>
      <section className="rl-flow rl-reminders">
        <div className="rl-step"><b>🗓️</b><strong>Sunday 9 PM</strong><small>Lines are due.</small></div>
        <div className="rl-step"><b>📊</b><strong>Monday EOD</strong><small>Scores are due.</small></div>
      </section>

      <div className="rl-motto" data-testid="rules-motto">Let's go! 🎾</div>
    </main>
  );
}
