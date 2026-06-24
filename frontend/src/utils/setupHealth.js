// Setup Health: a live validation engine that flags configuration problems
// before a season starts. It compares the editable config against the actual
// team/roster/rating data and returns prioritized issues.

import { normalizeConfig, tierForRating } from '../data/seasonConfig';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

function issue(severity, section, message) {
  return { severity, section, message };
}

export function evaluateSetupHealth(rawConfig, { teams = {}, playerRatings = {} } = {}) {
  const config = normalizeConfig(rawConfig);
  const issues = [];
  const teamList = Object.values(teams || {});

  // --- Teams -----------------------------------------------------------------
  if (teamList.length !== config.teams.count) {
    issues.push(issue(
      'warning',
      'Teams',
      `Config expects ${config.teams.count} teams but ${teamList.length} exist in the roster data.`
    ));
  }
  if (config.teams.minSquad > config.teams.maxSquad) {
    issues.push(issue('error', 'Squad', `Min squad (${config.teams.minSquad}) is greater than max squad (${config.teams.maxSquad}).`));
  }

  // --- Squad limits & captains ----------------------------------------------
  const teamsMissingCaptain = [];
  teamList.forEach(team => {
    const players = Array.isArray(team.players) ? team.players : [];
    const count = players.length;
    const label = team.abbreviation || team.name || team.id;
    if (count < config.teams.minSquad) {
      issues.push(issue('warning', 'Squad', `${label}: ${count} players — below the minimum of ${config.teams.minSquad}.`));
    }
    if (count > config.teams.maxSquad) {
      issues.push(issue('warning', 'Squad', `${label}: ${count} players — above the maximum of ${config.teams.maxSquad}.`));
    }
    const hasCaptain = players.some(p => p?.isCaptain) || team.captain;
    if (!hasCaptain) teamsMissingCaptain.push(label);
  });
  if (teamsMissingCaptain.length > 0) {
    issues.push(issue('error', 'Captains', `Missing captain on: ${teamsMissingCaptain.join(', ')}.`));
  }

  // --- Player pool vs. required roster --------------------------------------
  const totalPlayers = teamList.reduce((sum, team) => sum + (Array.isArray(team.players) ? team.players.length : 0), 0);
  const needed = config.teams.count * config.teams.minSquad;
  if (totalPlayers < needed) {
    issues.push(issue(
      'warning',
      'Pool',
      `${config.teams.count} teams × ${config.teams.minSquad} = ${needed} needed, only ${totalPlayers} players in pool — ${needed - totalPlayers} short.`
    ));
  }

  // --- Rating system ---------------------------------------------------------
  if (config.rating.type !== 'NONE') {
    if (!config.rating.tiers.length) {
      issues.push(issue('error', 'Rating', 'No rating tiers/bands are defined.'));
    } else {
      // Detect gaps/overlaps in the tier cutoffs.
      const sorted = [...config.rating.tiers].sort((a, b) => a.min - b.min);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].min > sorted[i - 1].max + 0.001) {
          issues.push(issue('info', 'Rating', `Gap between tiers "${sorted[i - 1].label}" and "${sorted[i].label}".`));
        }
      }
      sorted.forEach(tier => {
        if (tier.max < tier.min) issues.push(issue('error', 'Rating', `Tier "${tier.label}" has max below min.`));
      });
    }
    // Players missing a rating.
    let unrated = 0;
    teamList.forEach(team => (team.players || []).forEach(p => {
      const r = Number(p?.utr ?? p?.actualUtr);
      if (!Number.isFinite(r) || r <= 0) unrated += 1;
    }));
    if (unrated > 0) {
      issues.push(issue('info', 'Rating', `${unrated} player(s) have no ${config.rating.label} rating yet.`));
    }
  }

  // --- Format ----------------------------------------------------------------
  const lineSum = config.format.singlesLines + config.format.doublesLines;
  if (lineSum !== config.format.linesPerTie) {
    issues.push(issue(
      'warning',
      'Format',
      `Singles (${config.format.singlesLines}) + doubles (${config.format.doublesLines}) = ${lineSum}, but lines per match day is ${config.format.linesPerTie}.`
    ));
  }
  if (config.format.type === 'groups_playoffs') {
    if (config.format.groups.length < 1) {
      issues.push(issue('error', 'Format', 'Groups + playoffs format needs at least one group.'));
    }
    if (config.teams.count % config.format.groups.length !== 0) {
      issues.push(issue('info', 'Format', `${config.teams.count} teams across ${config.format.groups.length} groups is uneven.`));
    }
  }

  // --- Scoring ---------------------------------------------------------------
  if (config.scoring.tiebreakOrder.length === 0) {
    issues.push(issue('warning', 'Scoring', 'Tiebreak hierarchy is empty — standings ties will be unstable.'));
  }

  // --- Playoffs --------------------------------------------------------------
  const perGroup = config.format.groups.length
    ? Math.floor(config.teams.count / config.format.groups.length)
    : config.teams.count;
  if (config.playoffs.qualifyPerGroup > perGroup) {
    issues.push(issue('warning', 'Playoffs', `Qualify top ${config.playoffs.qualifyPerGroup}, but groups only hold ~${perGroup} teams.`));
  }

  // --- Roster balance (stacking) --------------------------------------------
  if (config.rating.type !== 'NONE' && teamList.length > 1) {
    const strengths = teamList.map(team => {
      const ratings = (team.players || []).map(p => Number(p?.utr ?? p?.actualUtr)).filter(r => Number.isFinite(r) && r > 0);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return { label: team.abbreviation || team.name || team.id, avg };
    }).filter(s => s.avg > 0);
    if (strengths.length > 1) {
      const avgs = strengths.map(s => s.avg);
      const max = Math.max(...avgs);
      const min = Math.min(...avgs);
      const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
      if (mean > 0 && (max - min) / mean > (1 - config.roster.stackFlagThreshold)) {
        const top = strengths.reduce((a, b) => (b.avg > a.avg ? b : a));
        issues.push(issue('info', 'Balance', `Squads look uneven — ${top.label} is stacked with higher-rated players (avg ${top.avg.toFixed(2)}).`));
      }
    }
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = issues.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {});
  return {
    issues,
    counts: { error: counts.error || 0, warning: counts.warning || 0, info: counts.info || 0 },
    ready: (counts.error || 0) === 0 && (counts.warning || 0) === 0
  };
}

// Re-export for convenience in the panel.
export { tierForRating };
