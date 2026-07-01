import type { PlayoffConfig, PlayoffMatch, PlayoffRoundType, Team } from '@/types';
import type { TournamentSubcollection } from './firestorePaths';
import type { TournamentScopedRepository } from './TournamentRepository';

// Supports brackets up to 8 entrants (QUARTERFINAL -> SEMIFINAL -> FINAL) — PlayoffRoundType
// has no ROUND_OF_16 or later, so a qualified field larger than this is truncated to the
// top MAX_BRACKET_SIZE seeds rather than silently mis-seeding a bigger bracket.
const MAX_BRACKET_SIZE = 8;

function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

// Standard single-elimination seeding order: seed 1 always meets the lowest remaining seed
// each round, so top seeds only meet in later rounds. E.g. seedOrder(8) => [1,8,4,5,2,7,3,6],
// i.e. first-round pairs (1,8) (4,5) (2,7) (3,6).
function seedOrder(bracketSize: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < bracketSize) {
    const size = seeds.length * 2;
    const next: number[] = [];
    seeds.forEach((s) => next.push(s, size + 1 - s));
    seeds = next;
  }
  return seeds;
}

function roundNamesFor(bracketSize: number): PlayoffRoundType[] {
  if (bracketSize >= 8) return ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'];
  if (bracketSize === 4) return ['SEMIFINAL', 'FINAL'];
  return ['FINAL'];
}

/**
 * Builds a single-elimination bracket from `qualifiedTeams`, already ordered best-seed-first
 * (see GeneratePlayoffs.tsx, which ranks by group standings position). Bracket size is the
 * next power of two >= qualifiedTeams.length (capped at MAX_BRACKET_SIZE); unfilled slots
 * are byes (team = null) that auto-advance their paired team immediately, since there's no
 * game to play or approve.
 *
 * Round labels (QUARTERFINAL/SEMIFINAL/FINAL) are implied purely by bracket depth, not by
 * config.playoffs.hasQuarterFinal/hasSemiFinal/hasFinal — those flags aren't independently
 * meaningful for a single bracket (you can't have a semifinal without a preceding round if
 * 8 teams qualified). config.playoffs.hasThirdPlaceMatch / hasBronzeMatch (treated as the
 * same feature) is respected; hasConsolationDraw (a full second bracket for early losers)
 * is not implemented.
 */
export function generatePlayoffBracket(qualifiedTeams: Team[], config: PlayoffConfig, now: number): PlayoffMatch[] {
  const capped = qualifiedTeams.slice(0, MAX_BRACKET_SIZE);
  const bracketSize = nextPowerOfTwo(capped.length);
  if (bracketSize < 2 || capped.length < 2) return [];

  const order = seedOrder(bracketSize);
  const seededTeams: (Team | null)[] = order.map((seed) => capped[seed - 1] ?? null);
  const roundNames = roundNamesFor(bracketSize);

  const matches: PlayoffMatch[] = [];
  let previousRoundMatches: PlayoffMatch[] = [];
  let matchCount = bracketSize / 2;

  roundNames.forEach((round, roundIndex) => {
    const isFirstRound = roundIndex === 0;
    const roundMatches: PlayoffMatch[] = [];
    for (let slot = 0; slot < matchCount; slot++) {
      const team1 = isFirstRound ? seededTeams[slot * 2] : null;
      const team2 = isFirstRound ? seededTeams[slot * 2 + 1] : null;
      roundMatches.push({
        id: `${round}-${slot}`,
        round,
        slot,
        team1Id: team1?.id ?? null,
        team2Id: team2?.id ?? null,
        team1Seed: isFirstRound ? order[slot * 2] : null,
        team2Seed: isFirstRound ? order[slot * 2 + 1] : null,
        matchId: null,
        winnerTeamId: null,
        nextMatchId: null,
        nextSlot: null,
        loserNextMatchId: null,
        loserNextSlot: null,
        createdAt: now,
      });
    }
    previousRoundMatches.forEach((prevMatch, i) => {
      const target = roundMatches[Math.floor(i / 2)];
      prevMatch.nextMatchId = target.id;
      prevMatch.nextSlot = i % 2 === 0 ? 'team1' : 'team2';
    });
    matches.push(...roundMatches);
    previousRoundMatches = roundMatches;
    matchCount = matchCount / 2;
  });

  // Byes auto-advance the paired team immediately — mutates the already-pushed match
  // objects in place (`matches` holds the same references as `roundMatches` above).
  matches.filter((m) => m.round === roundNames[0]).forEach((m) => {
    const hasBye = (m.team1Id == null) !== (m.team2Id == null);
    if (!hasBye) return;
    const winner = m.team1Id ?? m.team2Id;
    m.winnerTeamId = winner;
    if (m.nextMatchId && m.nextSlot && winner) {
      const target = matches.find((t) => t.id === m.nextMatchId);
      if (target) {
        if (m.nextSlot === 'team1') target.team1Id = winner; else target.team2Id = winner;
      }
    }
  });

  if ((config.hasThirdPlaceMatch || config.hasBronzeMatch) && roundNames.includes('SEMIFINAL')) {
    const semis = matches.filter((m) => m.round === 'SEMIFINAL');
    const thirdPlace: PlayoffMatch = {
      id: 'THIRD_PLACE-0', round: 'THIRD_PLACE', slot: 0,
      team1Id: null, team2Id: null, team1Seed: null, team2Seed: null,
      matchId: null, winnerTeamId: null,
      nextMatchId: null, nextSlot: null, loserNextMatchId: null, loserNextSlot: null,
      createdAt: now,
    };
    semis.forEach((m, i) => {
      m.loserNextMatchId = thirdPlace.id;
      m.loserNextSlot = i === 0 ? 'team1' : 'team2';
    });
    matches.push(thirdPlace);
  }

  return matches;
}

type Repo = <T extends { id: string }>(subcollection: TournamentSubcollection) => TournamentScopedRepository<T>;

/**
 * Called once a playoff bracket slot's Match is APPROVED (see ApproveScores.tsx and
 * ScoreEntry.tsx's admin-entry path): records the winner on that slot and propagates it
 * (and, for a semifinal with a third-place match configured, the loser) into whichever
 * slot(s) it feeds forward — the nextMatchId/nextSlot and loserNextMatchId/loserNextSlot
 * fields computed at generation time above.
 */
export async function advancePlayoffWinner(repo: Repo, playoffMatch: PlayoffMatch, winnerTeamId: string, matchId: string): Promise<void> {
  const loserTeamId = playoffMatch.team1Id === winnerTeamId ? playoffMatch.team2Id : playoffMatch.team1Id;
  const playoffRepo = repo<PlayoffMatch>('playoffMatches');
  await playoffRepo.update(playoffMatch.id, { winnerTeamId, matchId });
  if (playoffMatch.nextMatchId && playoffMatch.nextSlot) {
    const patch: Partial<Pick<PlayoffMatch, 'team1Id' | 'team2Id'>> =
      playoffMatch.nextSlot === 'team1' ? { team1Id: winnerTeamId } : { team2Id: winnerTeamId };
    await playoffRepo.update(playoffMatch.nextMatchId, patch);
  }
  if (playoffMatch.loserNextMatchId && playoffMatch.loserNextSlot && loserTeamId) {
    const patch: Partial<Pick<PlayoffMatch, 'team1Id' | 'team2Id'>> =
      playoffMatch.loserNextSlot === 'team1' ? { team1Id: loserTeamId } : { team2Id: loserTeamId };
    await playoffRepo.update(playoffMatch.loserNextMatchId, patch);
  }
}
