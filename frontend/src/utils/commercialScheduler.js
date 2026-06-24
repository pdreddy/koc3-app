import { roundRobin } from './roundRobin';
import { normalizeScheduleConfig } from './leagueConfig';

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseStart(dateISO, timeLabel) {
  const [hourText, minuteText = '0'] = String(timeLabel || '9:00 AM').replace(/\s+/g, ' ').split(':');
  const isPm = /pm/i.test(timeLabel || '');
  let hour = Number(hourText) || 9;
  const minute = Number(String(minuteText).replace(/[^0-9]/g, '')) || 0;
  if (isPm && hour < 12) hour += 12;
  if (!isPm && /am/i.test(timeLabel || '') && hour === 12) hour = 0;
  return new Date(`${dateISO}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
}

function nextPlayableDate(startDate, blackoutDates) {
  const next = new Date(`${startDate}T00:00:00`);
  const blackouts = new Set(blackoutDates || []);
  while (blackouts.has(isoDate(next))) next.setDate(next.getDate() + 1);
  return isoDate(next);
}

export function buildAutoSchedule(teams = [], config = {}, options = {}) {
  const scheduleConfig = normalizeScheduleConfig(config);
  const startDate = options.startDate || new Date().toISOString().slice(0, 10);
  const teamList = teams.filter(Boolean);
  if (teamList.length < 2) return {};

  if (scheduleConfig.format === 'knockout') return buildKnockoutSchedule(teamList, scheduleConfig, startDate);
  if (scheduleConfig.format === 'ladder') return buildLadderSchedule(teamList, scheduleConfig, startDate);
  return buildRoundRobinSchedule(teamList, scheduleConfig, startDate);
}

export function buildRoundRobinSchedule(teams, scheduleConfig, startDate) {
  const evenTeams = teams.length % 2 === 0 ? teams : [...teams, { id: 'bye', name: 'BYE', bye: true }];
  const pairings = roundRobin(evenTeams.length);
  const out = {};
  let dateISO = nextPlayableDate(startDate, scheduleConfig.blackoutDates);
  pairings.forEach((round, roundIndex) => {
    round.forEach(([a, b], matchIndex) => {
      const team1 = evenTeams[a];
      const team2 = evenTeams[b];
      if (team1.bye || team2.bye) return;
      const courtNumber = (matchIndex % scheduleConfig.courtCount) + 1;
      const slotNumber = Math.floor(matchIndex / scheduleConfig.courtCount);
      const start = addMinutes(parseStart(dateISO, scheduleConfig.defaultStartTime), slotNumber * scheduleConfig.slotDurationMinutes);
      const id = `rr-r${roundIndex + 1}-m${matchIndex + 1}`;
      out[id] = { id, type: 'match', format: 'roundRobin', round: roundIndex + 1, date: isoDate(start), time: start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), courtId: `court_${courtNumber}`, team1Id: team1.id, team2Id: team2.id, status: 'scheduled' };
    });
    const next = new Date(`${dateISO}T00:00:00`);
    next.setDate(next.getDate() + 7);
    dateISO = nextPlayableDate(isoDate(next), scheduleConfig.blackoutDates);
  });
  return out;
}

export function buildKnockoutSchedule(teams, scheduleConfig, startDate) {
  const out = {};
  const bracketSize = 2 ** Math.ceil(Math.log2(teams.length));
  const slots = [...teams, ...Array.from({ length: bracketSize - teams.length }, (_, i) => ({ id: `bye_${i + 1}`, bye: true }))];
  let match = 1;
  for (let i = 0; i < slots.length; i += 2) {
    if (slots[i].bye || slots[i + 1].bye) continue;
    const id = `ko-r1-m${match}`;
    out[id] = { id, type: 'match', format: 'knockout', round: 1, date: nextPlayableDate(startDate, scheduleConfig.blackoutDates), time: scheduleConfig.defaultStartTime, courtId: `court_${((match - 1) % scheduleConfig.courtCount) + 1}`, team1Id: slots[i].id, team2Id: slots[i + 1].id, status: 'scheduled' };
    match += 1;
  }
  return out;
}

export function buildLadderSchedule(teams, scheduleConfig, startDate) {
  const out = {};
  teams.slice(0, -1).forEach((team, index) => {
    const opponent = teams[index + 1];
    const id = `ladder-m${index + 1}`;
    out[id] = { id, type: 'match', format: 'ladder', round: 1, date: nextPlayableDate(startDate, scheduleConfig.blackoutDates), time: scheduleConfig.defaultStartTime, courtId: `court_${(index % scheduleConfig.courtCount) + 1}`, team1Id: team.id, team2Id: opponent.id, status: 'scheduled' };
  });
  return out;
}
