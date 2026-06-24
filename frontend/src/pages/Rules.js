import React from 'react';
import { normalizeConfig } from '../data/seasonConfig';

// Operational rule cards that are not derived from config (lines, scheduling,
// scores, weather, postponement). Participation, format, scoring and playoffs
// cards are generated from the season config below so the page adapts when an
// organizer changes the setup.
const staticCards = [
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
  }
];

function buildCardsFromConfig(cfg) {
  const p = cfg.participation;
  const f = cfg.format;
  const s = cfg.scoring;
  const po = cfg.playoffs;

  const participationCard = {
    num: '01', icon: '🏃', title: 'Player Participation',
    items: [
      ['👤', 'Regular Season', `Each player must play a minimum of ${p.minMatches} and a maximum of ${p.maxMatches} matches in the regular season.`],
      ['🎾', 'Singles Cap', `Each player can play a maximum of ${p.maxSinglesDays} singles match day${p.maxSinglesDays === 1 ? '' : 's'}.`],
      ['🤝', 'Same Doubles Pair', `The same doubles pair can partner together a maximum of ${p.maxPartnerDays} times.`],
      ...(p.injuryPolicy ? [['🩹', 'Injury / Replacement', p.injuryPolicy]] : [])
    ]
  };

  const formatCard = {
    num: '1a', icon: '🎾', title: 'Format',
    items: [
      ['🏟️', 'Competition', `${formatTypeLabel(f.type)}${f.groups.length > 1 ? ` · ${f.groups.length} groups` : ''}.`],
      ['🔢', 'Lines per Match Day', `${f.linesPerTie} lines — ${f.singlesLines} singles, ${f.doublesLines} doubles.`],
      ...f.lineFormats.map(line => [
        line.discipline === 'doubles' ? '👥' : '👤',
        line.label,
        `${line.discipline}, best of ${line.bestOf}${line.noAd ? ', no-ad scoring' : ''}${line.finalSetTiebreak ? ', match tiebreak final set' : ''}.`
      ])
    ]
  };

  const scoringCard = {
    num: '1b', icon: '🧮', title: 'Scoring & Standings',
    items: [
      ['✅', 'Points', `Win: ${s.pointsWin} · Loss: ${s.pointsLoss} · Forfeit: ${s.pointsForfeit}.`],
      ['📊', 'Tiebreakers', s.tiebreakOrder.map(tiebreakLabel).join(' → ') + '.']
    ]
  };

  const playoffsCard = {
    num: '07', icon: '🏆', title: 'Playoffs',
    items: [
      ['🥇', 'Qualification', `Top ${po.qualifyPerGroup} from each group advance.`],
      ['🗓️', 'Windows', `Semifinals: ${po.semisWindowDays}-day window. Finals: ${po.finalsWindowDays}-day window.`],
      ['☀️', 'Extra Buffer', 'Extra buffer is included for summer and Labor Day weekend.']
    ]
  };

  return { participationCard, formatCard, scoringCard, playoffsCard };
}

function formatTypeLabel(type) {
  return {
    round_robin: 'Round-robin',
    knockout: 'Knockout',
    groups_playoffs: 'Groups + playoffs',
    ladder: 'Ladder',
    swiss: 'Swiss'
  }[type] || 'Round-robin';
}

function tiebreakLabel(key) {
  return {
    points: 'Team Points', sets: 'Sets Won', singlesWins: 'Singles Wins',
    headToHead: 'Head-to-Head', games: 'Games Difference'
  }[key] || key;
}

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
      {card.items?.map((item, idx) => <RuleItem key={`${card.num}-${item[1]}-${idx}`} item={item} />)}
    </article>
  );
}

export default function Rules({ config }) {
  const cfg = normalizeConfig(config);
  const { participationCard, formatCard, scoringCard, playoffsCard } = buildCardsFromConfig(cfg);
  const cards = [participationCard, formatCard, scoringCard, ...staticCards, playoffsCard];

  return (
    <main className="container" data-testid="rules-page">
      <div className="page-title">
        <h1>Rules &amp; Format</h1>
        <p>Welcome to {cfg.club.seasonName}! Quick rundown before Week 1 — participation, format, scoring, weather and playoffs.</p>
      </div>

      <div className="rl-sec-head"><h2>The Rules</h2><div className="ln" /></div>
      <section className="rl-grid">{cards.map(card => <RuleCard key={card.num} card={card} />)}</section>

      <div className="rl-sec-head"><h2>Remember</h2><div className="ln" /></div>
      <section className="rl-flow rl-reminders">
        <div className="rl-step"><b>🗓️</b><strong>Sunday 9 PM</strong><small>Lines are due.</small></div>
        <div className="rl-step"><b>📊</b><strong>Monday EOD</strong><small>Scores are due.</small></div>
      </section>

      <div className="rl-motto">Let's go! 🎾</div>
    </main>
  );
}
