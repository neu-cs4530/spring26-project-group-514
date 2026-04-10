import { describe, expect, it } from "vitest";
import {
  createGame,
  expireGameByTimer,
  getGameTimer,
  joinGame,
  startGame,
} from "../../src/services/game.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { GameHistoryRepo, GameRepo } from "../../src/repository.ts";

async function getUser(username: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Missing test user ${username}`);
  return user;
}

describe("getGameTimer", () => {
  it("returns null for a game without a timer", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    const timer = await getGameTimer(game.gameId);
    expect(timer).toBeNull();
  });

  it("returns running timer for a started game with timer", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const game = await createGame(user1, "nim", new Date(), 60);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    const timer = await getGameTimer(game.gameId);
    expect(timer).toBeTruthy();
    expect(timer!.gameId).toBe(game.gameId);
    expect(timer!.isRunning).toBe(true);
    expect(timer!.remainingSeconds).toBeGreaterThan(0);
    expect(timer!.remainingSeconds).toBeLessThanOrEqual(60);
  });

  it("returns null for a nonexistent game", async () => {
    const timer = await getGameTimer("nonexistent-game-id");
    expect(timer).toBeNull();
  });

  it("returns not running for a completed game", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const game = await createGame(user1, "nim", new Date(), 60);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    // Mark game as done
    const record = await GameRepo.get(game.gameId);
    record.done = true;
    await GameRepo.set(game.gameId, record);

    const timer = await getGameTimer(game.gameId);
    expect(timer).toBeTruthy();
    expect(timer!.isRunning).toBe(false);
  });
});

describe("expireGameByTimer", () => {
  it("marks an active game as done and records history", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const game = await createGame(user1, "nim", new Date(), 10);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    const result = await expireGameByTimer(game.gameId);
    expect(result).toBeTruthy();
    expect(result!.done).toBe(true);
    expect(result!.moveDescription).toBe("timer expired");

    const history = await GameHistoryRepo.find(game.gameId);
    expect(history).toBeTruthy();
    expect(history!.endedByTimer).toBe(true);
  });

  it("returns null for a game that hasn't started", async () => {
    const user1 = await getUser("user1");
    const game = await createGame(user1, "nim", new Date(), 10);

    const result = await expireGameByTimer(game.gameId);
    expect(result).toBeNull();
  });

  it("returns null for an already completed game", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const game = await createGame(user1, "nim", new Date(), 10);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    // Expire once
    await expireGameByTimer(game.gameId);
    // Expire again should return null
    const result = await expireGameByTimer(game.gameId);
    expect(result).toBeNull();
  });

  it("returns null for a nonexistent game", async () => {
    const result = await expireGameByTimer("nonexistent-id");
    expect(result).toBeNull();
  });
});
