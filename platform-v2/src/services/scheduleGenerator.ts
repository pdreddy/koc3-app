import type { ScheduleEntry, Team } from '@/types';

// Round-robin pairings using the circle method — same algorithm ported from the koc3-app
// PR's utils/roundRobin.js, generalized here for TypeScript/Firestore. Returns `n-1` rounds,
// each an array of [teamIndexA, teamIndexB] pairs.
export function roundRobinPairings(n: number): [number, number][][] {
  if (n < 2 || n % 2 !== 0) throw new Error('Need an even number of teams for round-robin pairing');
  const teams = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = [];
    const arr = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      round.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(round);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ScheduleGroupInput {
  group: string;
  teams: Team[];
  firstDate: Date;
  time: string;
  weeklyIntervalDays?: number;
}

/**
 * Generalized round-robin schedule generator — every group gets its own round robin among
 * its teams, one round per week (or whatever weeklyIntervalDays is) starting at firstDate.
 * Odd-sized groups get a "bye" team injected (dropped from the output) so the circle method
 * still works.
 */
export function generateSchedule(groups: ScheduleGroupInput[], now: number): Omit<ScheduleEntry, 'id'>[] {
  const out: Omit<ScheduleEntry, 'id'>[] = [];

  groups.forEach(({ group, teams, firstDate, time, weeklyIntervalDays = 7 }) => {
    if (teams.length < 2) return;
    const hasBye = teams.length % 2 !== 0;
    const paddedTeams = hasBye ? [...teams, null] : teams;
    const pairings = roundRobinPairings(paddedTeams.length);

    pairings.forEach((round, roundIndex) => {
      const roundDate = new Date(firstDate.getTime());
      roundDate.setDate(firstDate.getDate() + roundIndex * weeklyIntervalDays);
      const dateISO = isoDate(roundDate);

      round.forEach(([i, j]) => {
        const t1 = paddedTeams[i];
        const t2 = paddedTeams[j];
        if (!t1 || !t2) return; // bye
        out.push({
          group,
          round: roundIndex + 1,
          date: dateISO,
          time,
          team1Id: t1.id,
          team2Id: t2.id,
          status: 'SCHEDULED',
          matchId: null,
          createdAt: now,
        });
      });
    });
  });

  return out;
}
