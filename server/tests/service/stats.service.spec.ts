import { beforeEach, describe, expect, it } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { createGame, joinGame, startGame, updateGame } from "../../src/services/game.service.ts";
import { GameRepo, PlayerStatsRepo } from "../../src/repository.ts";
import {
  getLeaderboard,
  getLeaderboardOptOut,
  getMatchHistory,
  getPlayerStats,
  setLeaderboardOptOut,
  updatePlayerStatsOnGameEnd,
} from "../../src/services/stats.service.ts";

beforeEach(async () => {
  await PlayerStatsRepo.clear();
});

async function getUser(username: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Missing test user ${username}`);
  return user;
}

async function playNimToCompletion(winnerUsername: string, loserUsername: string) {
  const winner = await getUser(winnerUsername);
  const loser = await getUser(loserUsername);

  const game = await createGame(winner, "nim", new Date(), null);
  await joinGame(game.gameId, loser);
  await startGame(game.gameId, winner);

  // Set up so the loser takes the last token
  const current = await GameRepo.get(game.gameId);
  current.state = { remaining: 1, nextPlayer: 1 };
  current.done = false;
  await GameRepo.set(game.gameId, current);

  await updateGame(game.gameId, loser, 1);
  return game.gameId;
}

describe("updatePlayerStatsOnGameEnd", () => {
  it("updates stats for a nim game winner and loser", async () => {
    await playNimToCompletion("user1", "user2");

    const winnerStats = await getPlayerStats("user1");
    expect(winnerStats).toBeTruthy();
    expect(winnerStats!.wins).toBe(1);
    expect(winnerStats!.losses).toBe(0);
    expect(winnerStats!.gamesPlayed).toBe(1);
    expect(winnerStats!.winRate).toBe(1);

    const loserStats = await getPlayerStats("user2");
    expect(loserStats).toBeTruthy();
    expect(loserStats!.wins).toBe(0);
    expect(loserStats!.losses).toBe(1);
  });

  it("awards first_win badge on first win", async () => {
    await playNimToCompletion("user1", "user2");

    const stats = await getPlayerStats("user1");
    expect(stats!.badges).toContain("first_win");
  });

  it("awards win_streak_3 badge after 3 consecutive wins and resets on loss", async () => {
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user1", "user2");

    const statsAfterStreak = await getPlayerStats("user1");
    expect(statsAfterStreak!.badges).toContain("win_streak_3");
    expect(statsAfterStreak!.wins).toBe(3);

    // user1 loses — streak resets but badge stays
    await playNimToCompletion("user2", "user1");

    const statsAfterLoss = await getPlayerStats("user1");
    expect(statsAfterLoss!.wins).toBe(3);
    expect(statsAfterLoss!.losses).toBe(1);
    expect(statsAfterLoss!.badges).toContain("win_streak_3");
  });

  it("handles guess game winner determination by closest guess", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    // Directly call updatePlayerStatsOnGameEnd with a guess state
    const guessState = { secret: 50, guesses: [48, 60] };
    await updatePlayerStatsOnGameEnd("guess", guessState, [user1.userId, user2.userId]);

    // user1 guessed 48 (distance 2), user2 guessed 60 (distance 10) — user1 wins
    const stats1 = await getPlayerStats("user1");
    expect(stats1!.wins).toBe(1);

    const stats2 = await getPlayerStats("user2");
    expect(stats2!.losses).toBe(1);
  });

  it("handles guess game tie (equal distance) — both count as wins", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    // Both guess equidistant from secret: distance = 10 each
    const guessState = { secret: 50, guesses: [40, 60] };
    await updatePlayerStatsOnGameEnd("guess", guessState, [user1.userId, user2.userId]);

    // Both should be winners
    const stats1 = await getPlayerStats("user1");
    const stats2 = await getPlayerStats("user2");
    expect(stats1!.wins).toBe(1);
    expect(stats2!.wins).toBe(1);
  });
});

describe("getMatchHistory", () => {
  it("returns empty history for a user with no games", async () => {
    const result = await getMatchHistory("user0", 1, 10);
    expect(result.data).toStrictEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns paginated match history after a completed game", async () => {
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user1", "user2");

    const page1 = await getMatchHistory("user1", 1, 1);
    expect(page1.data.length).toBe(1);
    expect(page1.total).toBe(2);
    expect(page1.totalPages).toBe(2);

    const page2 = await getMatchHistory("user1", 2, 1);
    expect(page2.data.length).toBe(1);
  });

  it("filters by game type", async () => {
    await playNimToCompletion("user1", "user2");

    const nimHistory = await getMatchHistory("user1", 1, 10, { gameType: "nim" });
    expect(nimHistory.data.length).toBe(1);

    const guessHistory = await getMatchHistory("user1", 1, 10, { gameType: "guess" });
    expect(guessHistory.data.length).toBe(0);
  });

  it("filters by opponent", async () => {
    await playNimToCompletion("user1", "user2");

    const withOpponent = await getMatchHistory("user1", 1, 10, { opponent: "user2" });
    expect(withOpponent.data.length).toBe(1);

    const withOther = await getMatchHistory("user1", 1, 10, { opponent: "user3" });
    expect(withOther.data.length).toBe(0);
  });

  it("filters by date range", async () => {
    await playNimToCompletion("user1", "user2");

    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();

    const inRange = await getMatchHistory("user1", 1, 10, { dateFrom: past, dateTo: future });
    expect(inRange.data.length).toBe(1);

    const outOfRange = await getMatchHistory("user1", 1, 10, {
      dateFrom: future,
      dateTo: future,
    });
    expect(outOfRange.data.length).toBe(0);
  });

  it("returns empty for nonexistent user", async () => {
    const result = await getMatchHistory("nonexistent_user", 1, 10);
    expect(result.data).toStrictEqual([]);
  });
});

describe("getLeaderboard", () => {
  it("returns ranked leaderboard entries sorted by win rate", async () => {
    // user1 wins 2, user2 wins 1
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user2", "user3");

    const result = await getLeaderboard(1, 10, "all");
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    // user1 should rank higher (100% win rate)
    const user1Entry = result.data.find((e) => e.username === "user1");
    const user2Entry = result.data.find((e) => e.username === "user2");
    expect(user1Entry).toBeTruthy();
    expect(user2Entry).toBeTruthy();
    expect(user1Entry!.rank).toBeLessThan(user2Entry!.rank);
  });

  it("filters out opted-out users", async () => {
    await playNimToCompletion("user1", "user2");

    const user1 = await getUser("user1");
    await setLeaderboardOptOut(user1.userId, true);

    const result = await getLeaderboard(1, 10, "all");
    expect(result.data.some((e) => e.username === "user1")).toBe(false);
  });

  it("paginates leaderboard results", async () => {
    await playNimToCompletion("user1", "user2");
    await playNimToCompletion("user3", "user0");

    const page1 = await getLeaderboard(1, 1, "all");
    expect(page1.data.length).toBe(1);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);
  });
});

describe("setLeaderboardOptOut / getLeaderboardOptOut", () => {
  it("defaults to not opted out", async () => {
    const user1 = await getUser("user1");
    const optOut = await getLeaderboardOptOut(user1.userId);
    expect(optOut).toBe(false);
  });

  it("creates a stats record if none exists when opting out", async () => {
    const user0 = await getUser("user0");
    await setLeaderboardOptOut(user0.userId, true);

    const optOut = await getLeaderboardOptOut(user0.userId);
    expect(optOut).toBe(true);

    // Stats should still show zero games
    const stats = await getPlayerStats("user0");
    expect(stats).toBeTruthy();
    expect(stats!.gamesPlayed).toBe(0);
  });

  it("can toggle opt-out back to false", async () => {
    const user1 = await getUser("user1");
    await setLeaderboardOptOut(user1.userId, true);
    expect(await getLeaderboardOptOut(user1.userId)).toBe(true);

    await setLeaderboardOptOut(user1.userId, false);
    expect(await getLeaderboardOptOut(user1.userId)).toBe(false);
  });
});
