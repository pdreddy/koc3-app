import type { Player } from '@/types';

export type TeamGenerationMethod = 'RANDOM' | 'BALANCED_SNAKE_DRAFT';

export interface GeneratedTeam {
  teamIndex: number;
  group: string;
  playerIds: string[];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function groupLabelFor(teamIndex: number, groupCount: number): string {
  // Distributes teams round-robin across groups (0,1,2,...,groupCount-1,0,1,2,...) so
  // groups end up as evenly sized as possible regardless of teamCount/groupCount divisibility.
  return String.fromCharCode(65 + (teamIndex % Math.max(groupCount, 1)));
}

/**
 * Splits `players` into `teamCount` teams.
 * - RANDOM: players shuffled, then dealt round-robin.
 * - BALANCED_SNAKE_DRAFT: players sorted by UTR (highest first, unrated last), dealt in
 *   snake order (1,2,...,N,N,...,2,1,...) so each team's average rating stays close —
 *   the same snake-draft idea used for fantasy-sports / pickup-game team building.
 */
export function generateTeams(
  players: Player[],
  teamCount: number,
  groupCount: number,
  method: TeamGenerationMethod
): GeneratedTeam[] {
  const ordered = method === 'BALANCED_SNAKE_DRAFT'
    ? [...players].sort((a, b) => (b.utrRating ?? -1) - (a.utrRating ?? -1))
    : shuffle(players);

  const teams: string[][] = Array.from({ length: teamCount }, () => []);

  if (method === 'BALANCED_SNAKE_DRAFT') {
    let index = 0;
    let direction = 1;
    ordered.forEach((player) => {
      teams[index].push(player.id);
      if (direction === 1 && index === teamCount - 1) direction = -1;
      else if (direction === -1 && index === 0) direction = 1;
      else index += direction;
    });
  } else {
    ordered.forEach((player, i) => teams[i % teamCount].push(player.id));
  }

  return teams.map((playerIds, teamIndex) => ({
    teamIndex,
    group: groupLabelFor(teamIndex, groupCount),
    playerIds,
  }));
}
