import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createGame, joinGame, startGame, updateGame } from "../src/services/game.service.ts";
import { GameRepo } from "../src/repository.ts";

const auth1 = { username: "user1", password: "pwd1111" };

async function createCompletedNimGame() {
  const user1 = await getUserByUsername("user1");
  const user2 = await getUserByUsername("user2");
  if (!user1 || !user2) throw new Error("Missing default test users");

  const game = await createGame(user1, "nim", new Date(), 120);
  await joinGame(game.gameId, user2);
  await startGame(game.gameId, user1);

  const current = await GameRepo.get(game.gameId);
  current.state = { remaining: 1, nextPlayer: 1 };
  current.done = false;
  await GameRepo.set(game.gameId, current);

  await updateGame(game.gameId, user2, 1);
  return game.gameId;
}

describe("US3 stats and leaderboard endpoints", () => {
  it("records completed games into history and stats, then surfaces them in leaderboard", async () => {
    const gameId = await createCompletedNimGame();

    const statsRes = await supertest(app).get(`/api/stats/player/user1`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.wins).toBe(1);
    expect(statsRes.body.gamesPlayed).toBe(1);

    const historyRes = await supertest(app).get(`/api/stats/history/user1?page=1&limit=10`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.data[0].gameId).toBe(gameId);
    expect(historyRes.body.data[0].result).toBe("win");

    const leaderboardRes = await supertest(app).get(
      `/api/stats/leaderboard?page=1&limit=10&period=all`,
    );
    expect(leaderboardRes.status).toBe(200);
    const leaderboardEntries = leaderboardRes.body.data as Array<{ username: string }>;
    expect(leaderboardEntries.some((entry) => entry.username === "user1")).toBe(true);
  });

  it("supports leaderboard period filter validation", async () => {
    const badPeriod = await supertest(app).get(
      `/api/stats/leaderboard?page=1&limit=10&period=year`,
    );
    expect(badPeriod.status).toBe(400);

    const okPeriod = await supertest(app).get(`/api/stats/leaderboard?page=1&limit=10&period=week`);
    expect(okPeriod.status).toBe(200);
  });

  it("respects leaderboard opt-out while keeping player stats", async () => {
    await createCompletedNimGame();

    const beforeOptOut = await supertest(app).get(
      `/api/stats/leaderboard?page=1&limit=10&period=all`,
    );
    expect(beforeOptOut.status).toBe(200);
    const beforeEntries = beforeOptOut.body.data as Array<{ username: string }>;
    expect(beforeEntries.some((entry) => entry.username === "user1")).toBe(true);

    const optOutRes = await supertest(app)
      .post(`/api/stats/leaderboard-opt-out`)
      .send({ auth: auth1, payload: { optOut: true } });
    expect(optOutRes.status).toBe(200);

    const statsRes = await supertest(app).get(`/api/stats/player/user1`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.gamesPlayed).toBe(1);

    const afterOptOut = await supertest(app).get(
      `/api/stats/leaderboard?page=1&limit=10&period=all`,
    );
    expect(afterOptOut.status).toBe(200);
    const afterEntries = afterOptOut.body.data as Array<{ username: string }>;
    expect(afterEntries.some((entry) => entry.username === "user1")).toBe(false);
  });
});
