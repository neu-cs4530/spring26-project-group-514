import type {
  AchievementBadge,
  GameKey,
  GuessState,
  NimState,
  UserBadgesInfo,
} from "@gamenite/shared";
import { GameHistoryRepo, UserRepo } from "../repository.ts";
import type { GameHistoryRecord } from "../models.ts";
import { getUserByUsername } from "./auth.service.ts";

interface UserStats {
  gamesPlayed: number;
  wins: number;
  winsByGame: Record<GameKey, number>;
}

function getWinningIndices(record: GameHistoryRecord): number[] {
  if (record.type === "nim") {
    const state = record.state as NimState;
    if (state.remaining !== 0) return [];
    return [state.nextPlayer];
  }

  if (record.type === "guess") {
    const state = record.state as GuessState;
    const guesses = state.guesses.filter((g): g is number => g !== null);
    if (guesses.length !== state.guesses.length) return [];

    let bestDistance = Number.POSITIVE_INFINITY;
    for (const guess of guesses) {
      const distance = Math.abs(guess - state.secret);
      if (distance < bestDistance) bestDistance = distance;
    }

    return state.guesses
      .map((guess, idx) => ({ guess, idx }))
      .filter(
        (entry) => entry.guess !== null && Math.abs(entry.guess - state.secret) === bestDistance,
      )
      .map((entry) => entry.idx);
  }

  return [];
}

function updateStatsFromHistory(stats: UserStats, record: GameHistoryRecord, userId: string) {
  const playerIndex = record.players.findIndex((id) => id === userId);
  if (playerIndex < 0) return;

  stats.gamesPlayed += 1;

  const winners = getWinningIndices(record);
  if (winners.includes(playerIndex)) {
    stats.wins += 1;
    stats.winsByGame[record.type] += 1;
  }
}

function deriveBadgesFromStats(stats: UserStats): AchievementBadge[] {
  const badges: AchievementBadge[] = [];

  if (stats.gamesPlayed >= 1) badges.push("first-game");
  if (stats.wins >= 1) badges.push("first-win");
  if (stats.gamesPlayed >= 5) badges.push("veteran-5-games");
  if (stats.winsByGame.nim >= 3) badges.push("nim-master-3-wins");
  if (stats.winsByGame.guess >= 3) badges.push("guess-master-3-wins");

  return badges;
}

async function computeUserStats(userId: string): Promise<UserStats> {
  const gameHistoryKeys = await GameHistoryRepo.getAllKeys();
  const gameHistory = await GameHistoryRepo.getMany(gameHistoryKeys);

  const stats: UserStats = {
    gamesPlayed: 0,
    wins: 0,
    winsByGame: { nim: 0, guess: 0 },
  };

  for (const record of gameHistory) {
    updateStatsFromHistory(stats, record, userId);
  }

  return stats;
}

/**
 * Recompute and store badges for all users in a finished game.
 */
export async function awardBadgesForCompletedGame(players: string[]): Promise<void> {
  await Promise.all(
    players.map(async (userId) => {
      const userRecord = await UserRepo.get(userId);
      const stats = await computeUserStats(userId);
      userRecord.badges = deriveBadgesFromStats(stats);
      await UserRepo.set(userId, userRecord);
    }),
  );
}

/**
 * Retrieve badges for a user by username.
 */
export async function getUserBadgesByUsername(username: string): Promise<UserBadgesInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error("User not found");

  const record = await UserRepo.get(user.userId);
  return {
    username: record.username,
    badges: record.badges ?? [],
  };
}
