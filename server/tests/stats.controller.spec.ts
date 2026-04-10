import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createGame, joinGame, startGame, updateGame } from "../src/services/game.service.ts";
import { GameRepo } from "../src/repository.ts";

const auth1 = { username: "user1", password: "pwd1111" };

async function createCompletedNimGame(winner: string, loser: string) {
  const winnerUser = await getUserByUsername(winner);
  const loserUser = await getUserByUsername(loser);
  if (!winnerUser || !loserUser) throw new Error("Missing test users");

  const game = await createGame(winnerUser, "nim", new Date(), null);
  await joinGame(game.gameId, loserUser);
  await startGame(game.gameId, winnerUser);

  const current = await GameRepo.get(game.gameId);
  current.state = { remaining: 1, nextPlayer: 1 };
  current.done = false;
  await GameRepo.set(game.gameId, current);

  await updateGame(game.gameId, loserUser, 1);
  return game.gameId;
}

describe("GET /api/stats/player/:username", () => {
  it("returns zero stats for a user with no games played", async () => {
    const res = await supertest(app).get("/api/stats/player/user0");
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      username: "user0",
      display: "user0",
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      winRate: 0,
      badges: [],
    });
  });

  it("returns stats after a completed game", async () => {
    await createCompletedNimGame("user1", "user2");

    const res = await supertest(app).get("/api/stats/player/user1");
    expect(res.status).toBe(200);
    expect(res.body.wins).toBe(1);
    expect(res.body.gamesPlayed).toBe(1);
    expect(res.body.winRate).toBe(1);
  });
});

describe("GET /api/stats/history/:username", () => {
  it("returns empty history for user with no games", async () => {
    const res = await supertest(app).get("/api/stats/history/user0?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.data).toStrictEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("returns history with correct result", async () => {
    const gameId = await createCompletedNimGame("user1", "user2");

    const winnerHistory = await supertest(app).get("/api/stats/history/user1?page=1&limit=10");
    expect(winnerHistory.status).toBe(200);
    expect(winnerHistory.body.data.length).toBe(1);
    expect(winnerHistory.body.data[0].gameId).toBe(gameId);
    expect(winnerHistory.body.data[0].result).toBe("win");

    const loserHistory = await supertest(app).get("/api/stats/history/user2?page=1&limit=10");
    expect(loserHistory.status).toBe(200);
    expect(loserHistory.body.data[0].result).toBe("loss");
  });

  it("supports gameType filter", async () => {
    await createCompletedNimGame("user1", "user2");

    const nimRes = await supertest(app).get(
      "/api/stats/history/user1?page=1&limit=10&gameType=nim",
    );
    expect(nimRes.body.data.length).toBe(1);

    const guessRes = await supertest(app).get(
      "/api/stats/history/user1?page=1&limit=10&gameType=guess",
    );
    expect(guessRes.body.data.length).toBe(0);
  });

  it("supports opponent filter", async () => {
    await createCompletedNimGame("user1", "user2");

    const withOpponent = await supertest(app).get(
      "/api/stats/history/user1?page=1&limit=10&opponent=user2",
    );
    expect(withOpponent.body.data.length).toBe(1);

    const noOpponent = await supertest(app).get(
      "/api/stats/history/user1?page=1&limit=10&opponent=user3",
    );
    expect(noOpponent.body.data.length).toBe(0);
  });
});

describe("GET /api/stats/leaderboard", () => {
  it("returns leaderboard with ranked entries", async () => {
    await createCompletedNimGame("user1", "user2");

    const res = await supertest(app).get("/api/stats/leaderboard?page=1&limit=10&period=all");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty("rank");
    expect(res.body.data[0]).toHaveProperty("username");
    expect(res.body.data[0]).toHaveProperty("winRate");
  });

  it("rejects invalid period parameter", async () => {
    const res = await supertest(app).get("/api/stats/leaderboard?page=1&limit=10&period=year");
    expect(res.status).toBe(400);
  });

  it("supports week and month periods", async () => {
    await createCompletedNimGame("user1", "user2");

    const weekRes = await supertest(app).get("/api/stats/leaderboard?page=1&limit=10&period=week");
    expect(weekRes.status).toBe(200);

    const monthRes = await supertest(app).get(
      "/api/stats/leaderboard?page=1&limit=10&period=month",
    );
    expect(monthRes.status).toBe(200);
  });

  it("paginates leaderboard", async () => {
    await createCompletedNimGame("user1", "user2");
    await createCompletedNimGame("user3", "user0");

    const page1 = await supertest(app).get("/api/stats/leaderboard?page=1&limit=1&period=all");
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(1);
    expect(page1.body.totalPages).toBeGreaterThanOrEqual(2);
  });
});

describe("POST /api/stats/leaderboard-opt-out", () => {
  it("rejects bad auth", async () => {
    const res = await supertest(app)
      .post("/api/stats/leaderboard-opt-out")
      .send({ auth: { username: "user1", password: "wrong" }, payload: { optOut: true } });
    expect(res.status).toBe(403);
  });

  it("rejects malformed request", async () => {
    const res = await supertest(app).post("/api/stats/leaderboard-opt-out").send({ bad: "data" });
    expect(res.status).toBe(400);
  });

  it("successfully toggles opt-out", async () => {
    const optOutRes = await supertest(app)
      .post("/api/stats/leaderboard-opt-out")
      .send({ auth: auth1, payload: { optOut: true } });
    expect(optOutRes.status).toBe(200);

    const statusRes = await supertest(app).get("/api/stats/leaderboard-opt-out/user1");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.optOut).toBe(true);
  });
});

describe("GET /api/stats/leaderboard-opt-out/:username", () => {
  it("returns false for user not opted out", async () => {
    await createCompletedNimGame("user1", "user2");

    const res = await supertest(app).get("/api/stats/leaderboard-opt-out/user1");
    expect(res.status).toBe(200);
    expect(res.body.optOut).toBe(false);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await supertest(app).get("/api/stats/leaderboard-opt-out/nonexistent");
    expect(res.status).toBe(404);
  });
});
