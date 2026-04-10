import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.ts";

let response: Response;

const auth0 = { username: "user0", password: "pwd0000" };
const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const auth3 = { username: "user3", password: "pwd3333" };
const authBad = { username: "user1", password: "wrong" };

function usernamesFromLobbyPlayers(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const maybePlayers = (body as { players?: unknown }).players;
  if (!Array.isArray(maybePlayers)) return [];

  return maybePlayers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const user = (entry as { user?: unknown }).user;
      if (!user || typeof user !== "object") return null;
      const username = (user as { username?: unknown }).username;
      return typeof username === "string" ? username : null;
    })
    .filter((username): username is string => username !== null);
}

function usernamesFromGamePlayers(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const maybePlayers = (body as { players?: unknown }).players;
  if (!Array.isArray(maybePlayers)) return [];

  return maybePlayers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const username = (entry as { username?: unknown }).username;
      return typeof username === "string" ? username : null;
    })
    .filter((username): username is string => username !== null);
}

/**
 * Helper: create a private lobby, invite user2, have user2 join, then start.
 * Returns the gameId of the resulting game.
 */
async function createPrivateGame(): Promise<string> {
  const created = await supertest(app)
    .post("/api/lobby/create")
    .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
  const lobbyId = created.body.lobbyId as string;

  await supertest(app)
    .post(`/api/lobby/${lobbyId}/invite`)
    .send({ auth: auth1, payload: { username: "user2" } });

  await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

  const started = await supertest(app)
    .post(`/api/lobby/${lobbyId}/start`)
    .send({ auth: auth1, payload: {} });

  return started.body.gameId as string;
}

/**
 * Helper: create a public lobby, have user2 join via the public lobby, then start.
 * Returns the gameId of the resulting game.
 */
async function createPublicGame(): Promise<string> {
  const created = await supertest(app)
    .post("/api/lobby/create")
    .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
  const lobbyId = created.body.lobbyId as string;

  await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

  const started = await supertest(app)
    .post(`/api/lobby/${lobbyId}/start`)
    .send({ auth: auth1, payload: {} });

  return started.body.gameId as string;
}

describe("POST /api/lobby/create", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app).post("/api/lobby/create").send({ auth: auth1, payload: {} });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: authBad, payload: { type: "nim", isPrivate: true } });
    expect(response.status).toBe(403);
  });

  it("creates a lobby with defaults and host joined", async () => {
    response = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      lobbyId: expect.anything(),
      type: "nim",
      isPrivate: true,
      code: expect.any(String),
      createdBy: { username: "user1", display: "Yāo", createdAt: expect.anything() },
      players: [
        {
          user: { username: "user1", display: "Yāo", createdAt: expect.anything() },
          status: "joined",
        },
      ],
      settings: { mode: "standard", difficulty: "normal", timerSeconds: null },
      chatId: expect.anything(),
      createdAt: expect.anything(),
    });
  });
});

describe("GET /api/lobby/list and GET /api/lobby/:id", () => {
  it("returns only public lobbies in list", async () => {
    await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    const publicLobby = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "guess", isPrivate: false } });

    response = await supertest(app).get("/api/lobby/list");
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].lobbyId).toBe(publicLobby.body.lobbyId);
    expect(response.body[0].isPrivate).toBe(false);
  });

  it("returns 404 for missing lobby id", async () => {
    response = await supertest(app).get(`/api/lobby/${randomUUID()}`);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/lobby/invited", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app).post("/api/lobby/invited").send({ auth: auth1, payload: 1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app).post("/api/lobby/invited").send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns only pending invited lobbies for the authenticated user", async () => {
    const invitedLobby = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    const publicLobby = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "guess", isPrivate: false } });

    await supertest(app)
      .post(`/api/lobby/${invitedLobby.body.lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    await supertest(app)
      .post(`/api/lobby/${publicLobby.body.lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    await supertest(app)
      .post(`/api/lobby/${publicLobby.body.lobbyId}/join`)
      .send({ auth: auth2, payload: {} });

    response = await supertest(app).post("/api/lobby/invited").send({ auth: auth2, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].lobbyId).toBe(invitedLobby.body.lobbyId);
    expect(response.body[0].players).toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ username: "user2" }),
        status: "pending",
      }),
    );
  });
});

describe("Invite/join/decline flow", () => {
  it("supports invite, join, and decline lifecycle", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
    const lobbyId = created.body.lobbyId as string;

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });
    expect(response.status).toBe(200);
    expect(response.body.players).toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ username: "user2" }),
        status: "pending",
      }),
    );

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/join`)
      .send({ auth: auth2, payload: {} });
    expect(response.status).toBe(200);
    expect(response.body.players).toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ username: "user2" }),
        status: "joined",
      }),
    );

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/decline`)
      .send({ auth: auth2, payload: {} });
    expect(response.status).toBe(200);
    expect(response.body.players).toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ username: "user2" }),
        status: "declined",
      }),
    );
  });

  it("rejects joining a private lobby without invite", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/join`)
      .send({ auth: auth2, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Cannot join a private lobby without an invite" });
  });
});

describe("Lobby controls and settings", () => {
  it("allows host to update settings", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "guess", isPrivate: false } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/settings`)
      .send({
        auth: auth1,
        payload: { mode: "casual", difficulty: "hard", timerSeconds: 45 },
      });

    expect(response.status).toBe(200);
    expect(response.body.settings).toStrictEqual({
      mode: "casual",
      difficulty: "hard",
      timerSeconds: 45,
    });
  });

  it("prevents non-host settings updates", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/settings`)
      .send({
        auth: auth2,
        payload: { mode: "casual", difficulty: "normal", timerSeconds: null },
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Only the host can update settings" });
  });

  it("prevents host from leaving and allows removing invited players", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/remove`)
      .send({ auth: auth1, payload: { username: "user2" } });
    expect(response.status).toBe(200);
    expect(usernamesFromLobbyPlayers(response.body)).not.toContain("user2");

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/leave`)
      .send({ auth: auth1, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Host cannot leave their own lobby" });
  });
});

describe("POST /api/lobby/:id/start", () => {
  it("returns 403 with invalid auth", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/start`)
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("starts lobby game, marks lobby started, and creates active game with joined players", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ gameId: expect.anything() });

    const gameId = response.body.gameId as string;

    const lobbyAfterStart = await supertest(app).get(`/api/lobby/${lobbyId}`);
    expect(lobbyAfterStart.status).toBe(200);
    expect(lobbyAfterStart.body.startedGameId).toBe(gameId);

    const gameAfterStart = await supertest(app)
      .get(`/api/game/${gameId}`)
      .set("x-username", "user1")
      .set("x-password", "pwd1111");
    expect(gameAfterStart.status).toBe(200);
    expect(gameAfterStart.body.type).toBe("nim");
    expect(gameAfterStart.body.status).toBe("active");
    expect(usernamesFromGamePlayers(gameAfterStart.body).sort()).toStrictEqual(["user1", "user2"]);
  });
});

describe("POST /api/lobby/:id/start — player count validation", () => {
  it("returns 400 when lobby exceeds max player count (nim: max 2)", async () => {
    // Create a nim lobby (maxPlayers: 2) and add 3 joined players
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth3, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Max player count exceeded. Max players: 2" });
  });

  it("returns 400 when lobby has fewer players than min player count", async () => {
    // Create a nim lobby (minPlayers: 2) with only the host
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Min player count not met" });
  });

  it("succeeds when player count is exactly at max (nim: 2)", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ gameId: expect.anything() });
  });

  it("succeeds with many players when maxPlayers is null (guess: unlimited)", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "guess", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth0, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth3, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ gameId: expect.anything() });
  });

  it("does not create a game when max player count is exceeded", async () => {
    const gamesBefore = await supertest(app).get("/api/game/list");

    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth3, payload: {} });

    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    const gamesAfter = await supertest(app).get("/api/game/list");
    expect(gamesAfter.body.length).toBe(gamesBefore.body.length);
  });
});

describe("POST /api/lobby/:id/start — race condition prevention", () => {
  it("concurrent start requests create only one game", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    const gamesBefore = await supertest(app).get("/api/game/list");

    // Fire two start requests concurrently
    const [res1, res2] = await Promise.all([
      supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} }),
      supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 200);
    const failures = [res1, res2].filter((r) => r.status === 400);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].body).toStrictEqual({ error: "Lobby already started" });

    // Only one new game should exist
    const gamesAfter = await supertest(app).get("/api/game/list");
    expect(gamesAfter.body.length).toBe(gamesBefore.body.length + 1);
  });

  it("second start request after first completes is rejected", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    const first = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });
    expect(first.status).toBe(200);

    const second = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth1, payload: {} });
    expect(second.status).toBe(400);
    expect(second.body).toStrictEqual({ error: "Lobby already started" });
  });
});

describe("Private game visibility (CoS 2.1, 2.2)", () => {
  it("game created from a private lobby has isPrivate: true", async () => {
    const gameId = await createPrivateGame();

    response = await supertest(app)
      .get(`/api/game/${gameId}`)
      .set("x-username", "user1")
      .set("x-password", "pwd1111");
    expect(response.status).toBe(200);
    expect(response.body.isPrivate).toBe(true);
  });

  it("game created from a public lobby has isPrivate: false", async () => {
    const gameId = await createPublicGame();

    response = await supertest(app).get(`/api/game/${gameId}`);
    expect(response.status).toBe(200);
    expect(response.body.isPrivate).toBe(false);
  });

  it("private games do not appear in GET /api/game/list", async () => {
    const privateGameId = await createPrivateGame();
    await createPublicGame();

    response = await supertest(app).get("/api/game/list");
    expect(response.status).toBe(200);

    const gameIds = (response.body as { gameId: string }[]).map((g) => g.gameId);
    expect(gameIds).not.toContain(privateGameId);
  });

  it("public games still appear in GET /api/game/list", async () => {
    await createPrivateGame();
    const publicGameId = await createPublicGame();

    response = await supertest(app).get("/api/game/list");
    expect(response.status).toBe(200);

    const gameIds = (response.body as { gameId: string }[]).map((g) => g.gameId);
    expect(gameIds).toContain(publicGameId);
  });
});

describe("POST /api/lobby/join-by-code", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app).post("/api/lobby/join-by-code").send({ auth: auth1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post("/api/lobby/join-by-code")
      .send({ auth: authBad, payload: { code: "AAAAAAAA" } });
    expect(response.status).toBe(403);
  });

  it("returns 400 when no lobby matches the code", async () => {
    response = await supertest(app)
      .post("/api/lobby/join-by-code")
      .send({ auth: auth2, payload: { code: "NOTACODE" } });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "No lobby found with code NOTACODE" });
  });

  it("joins a public lobby by code", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const code = created.body.code as string;

    response = await supertest(app)
      .post("/api/lobby/join-by-code")
      .send({ auth: auth2, payload: { code } });

    expect(response.status).toBe(200);
    expect(usernamesFromLobbyPlayers(response.body)).toContain("user2");
  });
});

describe("POST /api/lobby/:id/invite — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app).post(`/api/lobby/${randomUUID()}/invite`).send({ auth: auth1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/invite`)
      .send({ auth: authBad, payload: { username: "user2" } });
    expect(response.status).toBe(403);
  });

  it("returns 400 when inviting a non-existent user", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "noSuchUser" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "User noSuchUser not found" });
  });

  it("returns 400 when user is already in the lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "User user2 is already in this lobby" });
  });

  it("returns 400 when non-host tries to invite", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth2, payload: { username: "user3" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Only the host can invite players" });
  });
});

describe("POST /api/lobby/:id/join — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/join`)
      .send({ auth: auth1, payload: 1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/join`)
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/lobby/:id/leave — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/leave`)
      .send({ auth: auth1, payload: 1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/leave`)
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("successfully leaves a public lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/leave`)
      .send({ auth: auth2, payload: {} });

    expect(response.status).toBe(200);
    expect(usernamesFromLobbyPlayers(response.body)).not.toContain("user2");
  });
});

describe("POST /api/lobby/:id/decline — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/decline`)
      .send({ auth: auth1, payload: 1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/decline`)
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns 400 when user is not invited", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/decline`)
      .send({ auth: auth2, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "You are not invited to this lobby" });
  });
});

describe("POST /api/lobby/:id/remove — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app).post(`/api/lobby/${randomUUID()}/remove`).send({ auth: auth1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/remove`)
      .send({ auth: authBad, payload: { username: "user2" } });
    expect(response.status).toBe(403);
  });

  it("returns 400 when trying to remove the host", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/remove`)
      .send({ auth: auth1, payload: { username: "user1" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Cannot remove the host" });
  });

  it("returns 400 when non-host tries to remove", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/remove`)
      .send({ auth: auth2, payload: { username: "user1" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Only the host can remove players" });
  });

  it("returns 400 when target user does not exist", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });

    response = await supertest(app)
      .post(`/api/lobby/${created.body.lobbyId}/remove`)
      .send({ auth: auth1, payload: { username: "noSuchUser" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "User noSuchUser not found" });
  });
});

describe("POST /api/lobby/:id/settings — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/settings`)
      .send({ auth: auth1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/settings`)
      .send({
        auth: authBad,
        payload: { mode: "standard", difficulty: "normal", timerSeconds: null },
      });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/lobby/:id/start — error paths", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/start`)
      .send({ auth: auth1, payload: 1 });
    expect(response.status).toBe(400);
  });

  it("returns 403 with invalid auth", async () => {
    response = await supertest(app)
      .post(`/api/lobby/${randomUUID()}/start`)
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns 400 when non-host tries to start", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/start`)
      .send({ auth: auth2, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Only the host can start the game" });
  });
});

describe("Lobby actions after start are rejected", () => {
  it("returns 400 when inviting to a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user3" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });

  it("returns 400 when joining a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/join`)
      .send({ auth: auth3, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });

  it("returns 400 when leaving a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/leave`)
      .send({ auth: auth2, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });

  it("returns 400 when updating settings of a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/settings`)
      .send({
        auth: auth1,
        payload: { mode: "casual", difficulty: "hard", timerSeconds: 30 },
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });

  it("returns 400 when declining invite on a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: true } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user2" } });
    await supertest(app)
      .post(`/api/lobby/${lobbyId}/invite`)
      .send({ auth: auth1, payload: { username: "user3" } });
    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/decline`)
      .send({ auth: auth3, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });

  it("returns 400 when removing a player from a started lobby", async () => {
    const created = await supertest(app)
      .post("/api/lobby/create")
      .send({ auth: auth1, payload: { type: "nim", isPrivate: false } });
    const lobbyId = created.body.lobbyId as string;

    await supertest(app).post(`/api/lobby/${lobbyId}/join`).send({ auth: auth2, payload: {} });
    await supertest(app).post(`/api/lobby/${lobbyId}/start`).send({ auth: auth1, payload: {} });

    response = await supertest(app)
      .post(`/api/lobby/${lobbyId}/remove`)
      .send({ auth: auth1, payload: { username: "user2" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Lobby already started" });
  });
});

describe("Private game access control", () => {
  it("a participant can GET a private game by id", async () => {
    const gameId = await createPrivateGame();

    response = await supertest(app)
      .get(`/api/game/${gameId}`)
      .set("x-username", "user1")
      .set("x-password", "pwd1111");
    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe(gameId);
  });

  it("a non-participant gets 403 on a private game", async () => {
    const gameId = await createPrivateGame();

    response = await supertest(app)
      .get(`/api/game/${gameId}`)
      .set("x-username", "user3")
      .set("x-password", "pwd3333");
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Not a participant in this game" });
  });

  it("no auth headers on a private game returns 401", async () => {
    const gameId = await createPrivateGame();

    response = await supertest(app).get(`/api/game/${gameId}`);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: "Authentication required" });
  });

  it("bad credentials on a private game returns 401", async () => {
    const gameId = await createPrivateGame();

    response = await supertest(app)
      .get(`/api/game/${gameId}`)
      .set("x-username", "user1")
      .set("x-password", "wrong");
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("public games remain accessible without auth", async () => {
    const gameId = await createPublicGame();

    response = await supertest(app).get(`/api/game/${gameId}`);
    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe(gameId);
  });
});
