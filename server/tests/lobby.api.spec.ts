import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.ts";

let response: Response;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
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
