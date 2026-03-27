import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };

/**
 * lobby lifecycle integreation
 * 
 * create -> invite -> join -> start -> verify linked game and started lobby state.
 */
describe("lobby lifecycle integration", () => {
  it("transitions from private lobby to started game with joined players", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    expect(created.status).toBe(200);
    const lobbyId = created.body.lobbyId as string;

    const invited = await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });
    expect(invited.status).toBe(200);

    const joined = await supertest(app)
      .post(`/api/lobby/${lobbyId}/join`)
      .send({ auth: auth2, payload: {} });
    expect(joined.status).toBe(200);

    const started = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });
    expect(started.status).toBe(200);
    expect(started.body.gameId).toEqual(expect.any(String));

    const game = await supertest(app).get(`/api/game/${started.body.gameId as string}`);
    expect(game.status).toBe(200);
    expect(game.body.type).toBe("nim");
    expect(game.body.status).toBe("active");
    const usernames = (game.body.players as { username: string }[]).map((player) => player.username);
    expect(usernames).toEqual(expect.arrayContaining(["user1", "user2"]));

    const lobby = await supertest(app).get(`/api/lobby/${lobbyId}`);
    expect(lobby.status).toBe(200);
    expect(lobby.body.startedGameId).toBe(started.body.gameId);

    const list = await supertest(app).get("/api/lobby/list");
    expect(list.status).toBe(200);
    expect((list.body as { lobbyId: string }[]).some((entry) => entry.lobbyId === lobbyId)).toBe(
      false,
    );
  });
});
