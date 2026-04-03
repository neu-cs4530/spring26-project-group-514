import {
  type GameKey,
  type GuessState,
  type NimState,
  type PlayerStats,
  type MatchHistoryEntry,
  type PaginatedResponse,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "@gamenite/shared";
import { GameHistoryRepo, PlayerStatsRepo, UserRepo } from "../repository.ts";
import type { PlayerStatsRecord } from "../models.ts";

/**
 * Determine the winner player indices from a completed game's state.
 * Returns an array of winner indices (may be multiple in case of a tie).
 */
function getWinnerIndices(type: GameKey, state: unknown): number[] {
  if (type === "nim") {
    const nimState = state as NimState;
    // In Nim, when remaining = 0, nextPlayer is the one who didn't take the
    // last token — they win.
    return [nimState.nextPlayer];
  }

  if (type === "guess") {
    const guessState = state as GuessState;
    const distances = guessState.guesses.map((guess) =>
      guess !== null ? Math.abs(guess - guessState.secret) : Infinity,
    );
    const minDistance = Math.min(...distances);
    // All players who tied for closest guess win
    return distances.map((d, i) => (d === minDistance ? i : -1)).filter((i) => i !== -1);
  }

  return [];
}

/**
 * Update player stats after a game ends. Called from game.service.ts.
 */
export async function updatePlayerStatsOnGameEnd(
  type: GameKey,
  state: unknown,
  playerUserIds: string[],
): Promise<void> {
  const winnerIndices = getWinnerIndices(type, state);
  const now = new Date().toISOString();

  await Promise.all(
    playerUserIds.map(async (userId, playerIndex) => {
      const existing = await PlayerStatsRepo.find(userId);
      const user = await UserRepo.get(userId);
      const isWinner = winnerIndices.includes(playerIndex);

      const wins = (existing?.wins ?? 0) + (isWinner ? 1 : 0);
      const losses = (existing?.losses ?? 0) + (isWinner ? 0 : 1);
      const gamesPlayed = wins + losses;

      const record: PlayerStatsRecord = {
        userId,
        username: user.username,
        wins,
        losses,
        gamesPlayed,
        winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
        leaderboardOptOut: existing?.leaderboardOptOut ?? false,
        lastPlayedAt: now,
      };

      await PlayerStatsRepo.set(userId, record);
    }),
  );
}

/**
 * Get a player's stats by username.
 */
export async function getPlayerStats(username: string): Promise<PlayerStats | null> {
  const allKeys = await PlayerStatsRepo.getAllKeys();
  for (const key of allKeys) {
    const record = await PlayerStatsRepo.get(key);
    if (record.username === username) {
      return {
        username: record.username,
        display: record.username,
        wins: record.wins,
        losses: record.losses,
        gamesPlayed: record.gamesPlayed,
        winRate: record.winRate,
      };
    }
  }
  return null;
}

/**
 * Get paginated match history for a user, with optional filters.
 */
export async function getMatchHistory(
  username: string,
  page: number,
  limit: number,
  filters?: { gameType?: string; opponent?: string; dateFrom?: string; dateTo?: string },
): Promise<PaginatedResponse<MatchHistoryEntry>> {
  // Find the userId for this username
  const userKeys = await UserRepo.getAllKeys();
  let targetUserId: string | null = null;
  for (const key of userKeys) {
    const user = await UserRepo.get(key);
    if (user.username === username) {
      targetUserId = key;
      break;
    }
  }
  if (!targetUserId) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  // Get all game history entries involving this user
  const historyKeys = await GameHistoryRepo.getAllKeys();
  const entries: (MatchHistoryEntry & { endedAtDate: Date })[] = [];

  for (const gameId of historyKeys) {
    const record = await GameHistoryRepo.get(gameId);
    if (!record.players.includes(targetUserId)) continue;

    // Apply filters
    if (filters?.gameType && record.type !== filters.gameType) continue;

    const endedAtDate = new Date(record.endedAt);
    if (filters?.dateFrom && endedAtDate < new Date(filters.dateFrom)) continue;
    if (filters?.dateTo && endedAtDate > new Date(filters.dateTo)) continue;

    // Resolve player usernames
    const playerUsernames = await Promise.all(
      record.players.map(async (uid) => {
        const user = await UserRepo.get(uid);
        return user.username;
      }),
    );

    if (filters?.opponent && !playerUsernames.some((u) => u === filters.opponent)) continue;

    // Determine result for this user
    const playerIndex = record.players.indexOf(targetUserId);
    const winnerIndices = getWinnerIndices(record.type, record.state);
    let result: "win" | "loss" | "draw";
    if (winnerIndices.length === record.players.length) {
      result = "draw";
    } else if (winnerIndices.includes(playerIndex)) {
      result = "win";
    } else {
      result = "loss";
    }

    entries.push({
      gameId,
      type: record.type,
      players: playerUsernames,
      result,
      endedAt: record.endedAt,
      endedAtDate,
    });
  }

  // Sort by date descending
  entries.sort((a, b) => b.endedAtDate.getTime() - a.endedAtDate.getTime());

  const total = entries.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = entries.slice(start, start + limit).map(({ endedAtDate: _, ...rest }) => rest);

  return { data: paged, total, page, limit, totalPages };
}

/**
 * Get the global leaderboard with pagination and time-period filtering.
 */
export async function getLeaderboard(
  page: number,
  limit: number,
  period: LeaderboardPeriod = "all",
): Promise<PaginatedResponse<LeaderboardEntry>> {
  const allKeys = await PlayerStatsRepo.getAllKeys();
  const allStats: PlayerStatsRecord[] = [];

  const now = new Date();
  let cutoff: Date | null = null;
  if (period === "week") {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  for (const key of allKeys) {
    const record = await PlayerStatsRepo.get(key);
    // Exclude opted-out users
    if (record.leaderboardOptOut) continue;
    // Apply time period filter
    if (cutoff && new Date(record.lastPlayedAt) < cutoff) continue;
    allStats.push(record);
  }

  // Sort by win rate descending, then by total wins descending
  allStats.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.wins - a.wins;
  });

  const total = allStats.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = allStats.slice(start, start + limit);

  const data: LeaderboardEntry[] = paged.map((record, i) => ({
    rank: start + i + 1,
    username: record.username,
    display: record.username,
    wins: record.wins,
    losses: record.losses,
    gamesPlayed: record.gamesPlayed,
    winRate: record.winRate,
  }));

  return { data, total, page, limit, totalPages };
}

/**
 * Toggle leaderboard opt-out for a user.
 */
export async function setLeaderboardOptOut(userId: string, optOut: boolean): Promise<void> {
  const existing = await PlayerStatsRepo.find(userId);
  if (existing) {
    existing.leaderboardOptOut = optOut;
    await PlayerStatsRepo.set(userId, existing);
  } else {
    // Create a default stats record with the opt-out setting
    const user = await UserRepo.get(userId);
    await PlayerStatsRepo.set(userId, {
      userId,
      username: user.username,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      winRate: 0,
      leaderboardOptOut: optOut,
      lastPlayedAt: new Date().toISOString(),
    });
  }
}

/**
 * Get leaderboard opt-out status for a user.
 */
export async function getLeaderboardOptOut(userId: string): Promise<boolean> {
  const existing = await PlayerStatsRepo.find(userId);
  return existing?.leaderboardOptOut ?? false;
}
