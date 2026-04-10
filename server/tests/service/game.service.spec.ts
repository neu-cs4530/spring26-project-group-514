import { describe, expect, it } from "vitest";
import {
  createGame,
  expireGameByTimer,
  getGameScores,
  getGameTimer,
  getGames,
  joinGame,
  startGame,
  updateGame,
} from "../../src/services/game.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { GameHistoryRepo } from "../../src/repository.ts";
import { getPlayerStats } from "../../src/services/stats.service.ts";

async function expectedLeaderboardScores(usernames: string[]) {
  return Promise.all(
    usernames.map(async (username, playerIndex) => {
      const stats = await getPlayerStats(username);
      return { playerIndex, score: stats?.wins ?? 0 };
    }),
  );
}

describe("getGameScores", () => {
  it("returns current scores for an active guess game", async () => {
    const activeGuess = (await getGames()).find(
      (game) => game.type === "guess" && game.status === "active",
    );
    expect(activeGuess).toBeTruthy();

    const payload = await getGameScores(activeGuess!.gameId);
    expect(payload.gameId).toBe(activeGuess!.gameId);
    expect(payload.scores).toStrictEqual(
      await expectedLeaderboardScores(activeGuess!.players.map((player) => player.username)),
    );
  });

  it("updates scores after a move", async () => {
    const activeGuess = (await getGames()).find(
      (game) => game.type === "guess" && game.status === "active",
    );
    expect(activeGuess).toBeTruthy();

    const player = await getUserByUsername("user1");
    expect(player).toBeTruthy();

    await updateGame(activeGuess!.gameId, player!, 43);

    const payload = await getGameScores(activeGuess!.gameId);
    expect(payload.scores).toStrictEqual(
      await expectedLeaderboardScores(
        activeGuess!.players.map((gamePlayer) => gamePlayer.username),
      ),
    );
  });

  it("returns winner scoring for a completed nim game", async () => {
    const doneNim = (await getGames()).find(
      (game) => game.type === "nim" && game.status === "done",
    );
    expect(doneNim).toBeTruthy();

    const payload = await getGameScores(doneNim!.gameId);
    expect(payload.scores).toStrictEqual(
      await expectedLeaderboardScores(doneNim!.players.map((player) => player.username)),
    );
  });
});

describe("game timers", () => {
  it("starts a timer for a started game with a configured duration", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    expect(user1).toBeTruthy();
    expect(user2).toBeTruthy();

    const game = await createGame(user1!, "nim", new Date(), 20);
    await joinGame(game.gameId, user2!);
    await startGame(game.gameId, user1!);

    const timer = await getGameTimer(game.gameId);
    expect(timer).toBeTruthy();
    expect(timer?.isRunning).toBe(true);
    expect(timer?.remainingSeconds).toBeGreaterThan(0);
  });

  it("expires a game by timer and records history", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    expect(user1).toBeTruthy();
    expect(user2).toBeTruthy();

    const game = await createGame(user1!, "nim", new Date(), 5);
    await joinGame(game.gameId, user2!);
    await startGame(game.gameId, user1!);

    const expired = await expireGameByTimer(game.gameId);
    expect(expired).toBeTruthy();
    expect(expired?.done).toBe(true);

    const history = await GameHistoryRepo.find(game.gameId);
    expect(history).toBeTruthy();
    expect(history?.endedByTimer).toBe(true);
  });
});
