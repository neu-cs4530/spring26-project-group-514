import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { socketWatch } from "../src/controllers/game.controller.ts";
import {
  socketStart,
  socketWatch as lobbySocketWatch,
  socketUnwatch,
  socketJoin as lobbySocketJoin,
  socketLeave as lobbySocketLeave,
  socketInvitePlayer,
  socketDeclineInvite,
  socketRemovePlayer,
  socketUpdateSettings,
} from "../src/controllers/lobby.controller.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createGame, joinGame, startGame } from "../src/services/game.service.ts";
import {
  createLobby,
  invitePlayer,
  joinLobby,
  markLobbyStarted,
} from "../src/services/lobby.service.ts";

vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const MockGameServerSocket = vi.fn(
  class {
    id = "mockGameServerSocket";
    rooms = new Set<string>();
    join = vi.fn();
    emit = vi.fn();
    leave = vi.fn();
    to = vi.fn(() => this);
  },
);

const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const auth3 = { username: "user3", password: "pwd3333" };
const authBad = { username: "user1", password: "wrong" };

afterEach(() => {
  vi.resetAllMocks();
});

async function seedPrivateGame(): Promise<string> {
  const user1 = (await getUserByUsername("user1"))!;
  const user2 = (await getUserByUsername("user2"))!;
  const game = await createGame(user1, "nim", new Date(), null, true);
  await joinGame(game.gameId, user2);
  await startGame(game.gameId, user1);
  return game.gameId;
}

async function seedPublicGame(): Promise<string> {
  const user1 = (await getUserByUsername("user1"))!;
  const user2 = (await getUserByUsername("user2"))!;
  const game = await createGame(user1, "nim", new Date(), null, false);
  await joinGame(game.gameId, user2);
  await startGame(game.gameId, user1);
  return game.gameId;
}

describe("socketStart error surfacing", () => {
  it("emits lobbyError when lobby exceeds max player count", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const user3 = (await getUserByUsername("user3"))!;

    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);
    await joinLobby(lobby.lobbyId, user3);

    await socketStart(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("lobbyError", {
      lobbyId: lobby.lobbyId,
      error: "Max player count exceeded. Max players: 2",
    });
  });

  it("emits lobbyError when lobby has fewer than min players", async () => {
    const host = (await getUserByUsername("user1"))!;

    const lobby = await createLobby(host, "nim", false, new Date());

    await socketStart(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("lobbyError", {
      lobbyId: lobby.lobbyId,
      error: "Min player count not met",
    });
  });

  it("does not emit lobbyError on successful start and broadcasts lobbyStarted", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;

    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await socketStart(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.emit).not.toHaveBeenCalledWith("lobbyError", expect.anything());
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyStarted",
      expect.objectContaining({ lobbyId: lobby.lobbyId, gameId: expect.any(String) }),
    );
  });

  it("logs error and does not emit lobbyError when payload is invalid", async () => {
    await socketStart(mockSocket, mockServer)("not valid");

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.anything());
    expect(mockSocket.emit).not.toHaveBeenCalledWith("lobbyError", expect.anything());
  });

  it("logs error when auth is invalid", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketStart(
      mockSocket,
      mockServer,
    )({
      auth: authBad,
      payload: lobby.lobbyId,
    });

    expect(logSocketError).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "lobbyError",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
  });
});

describe("lobbySocketWatch", () => {
  it("joins the lobby room and emits lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await lobbySocketWatch(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.join).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("emits lobbyStarted if lobby is already started", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    // Start the lobby manually via the service
    const game = await createGame(host, "nim", new Date(), null, false);
    await markLobbyStarted(lobby.lobbyId, game.gameId);

    await lobbySocketWatch(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("lobbyUpdated", expect.anything());
    expect(mockSocket.emit).toHaveBeenCalledWith("lobbyStarted", {
      lobbyId: lobby.lobbyId,
      gameId: game.gameId,
    });
  });

  it("logs error when lobby is not found", async () => {
    await lobbySocketWatch(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: "nonexistent-lobby-id",
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("logs error when auth is invalid", async () => {
    await lobbySocketWatch(
      mockSocket,
      mockServer,
    )({
      auth: authBad,
      payload: "some-lobby",
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketUnwatch", () => {
  it("leaves the lobby room", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketUnwatch(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.leave).toHaveBeenCalledWith(lobby.lobbyId);
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when auth is invalid", async () => {
    await socketUnwatch(
      mockSocket,
      mockServer,
    )({
      auth: authBad,
      payload: "some-lobby",
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("lobbySocketJoin", () => {
  it("joins the lobby and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await lobbySocketJoin(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: lobby.lobbyId,
    });

    expect(mockSocket.join).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when joining a private lobby without invite", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await lobbySocketJoin(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: lobby.lobbyId,
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("lobbySocketLeave", () => {
  it("leaves the lobby and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await lobbySocketLeave(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: lobby.lobbyId,
    });

    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when host tries to leave", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await lobbySocketLeave(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: lobby.lobbyId,
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketInvitePlayer", () => {
  it("invites a player and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketInvitePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { lobbyId: lobby.lobbyId, username: "user2" },
    });

    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when non-host invites", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await socketInvitePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: { lobbyId: lobby.lobbyId, username: "user3" },
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketDeclineInvite", () => {
  it("declines an invite and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    await socketDeclineInvite(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: lobby.lobbyId,
    });

    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when user is not invited", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketDeclineInvite(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: lobby.lobbyId,
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketRemovePlayer", () => {
  it("removes a player and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    await socketRemovePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { lobbyId: lobby.lobbyId, username: "user2" },
    });

    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when non-host removes", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await socketRemovePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: { lobbyId: lobby.lobbyId, username: "user1" },
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketUpdateSettings", () => {
  it("updates settings and broadcasts updated state", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketUpdateSettings(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: {
        lobbyId: lobby.lobbyId,
        settings: { mode: "casual", difficulty: "hard", timerSeconds: 30 },
      },
    });

    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({
        lobbyId: lobby.lobbyId,
        settings: { mode: "casual", difficulty: "hard", timerSeconds: 30 },
      }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("logs error when non-host updates settings", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await socketUpdateSettings(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: {
        lobbyId: lobby.lobbyId,
        settings: { mode: "casual", difficulty: "hard", timerSeconds: 30 },
      },
    });

    expect(logSocketError).toHaveBeenCalledWith(mockSocket, expect.any(Error));
  });
});

describe("socketWatch private game access control", () => {
  it("allows a participant to watch a private game", async () => {
    const gameId = await seedPrivateGame();

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: gameId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameWatched",
      expect.objectContaining({ gameId }),
    );
  });

  it("rejects a non-participant from watching a private game", async () => {
    const gameId = await seedPrivateGame();

    await socketWatch(mockSocket, mockServer)({ auth: auth3, payload: gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("Not a participant in this private game"),
    );
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("allows anyone to watch a public game", async () => {
    const gameId = await seedPublicGame();

    await socketWatch(mockSocket, mockServer)({ auth: auth3, payload: gameId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameWatched",
      expect.objectContaining({ gameId }),
    );
  });
});
