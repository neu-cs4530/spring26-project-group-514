import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { socketWatch } from "../src/controllers/game.controller.ts";
import {
  socketStart,
  socketWatch as lobbySocketWatch,
  socketUnwatch,
  socketJoin,
  socketLeave,
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

  it("does not emit lobbyError on successful start", async () => {
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

describe("lobbySocketWatch", () => {
  it("joins the lobby room and emits lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await lobbySocketWatch(mockSocket, mockServer)({ auth: auth1, payload: lobby.lobbyId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
  });

  it("emits lobbyStarted if lobby already started", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await markLobbyStarted(lobby.lobbyId, "game-xyz");

    await lobbySocketWatch(mockSocket, mockServer)({ auth: auth1, payload: lobby.lobbyId });

    expect(mockSocket.emit).toHaveBeenCalledWith("lobbyStarted", {
      lobbyId: lobby.lobbyId,
      gameId: "game-xyz",
    });
  });

  it("logs error for nonexistent lobby", async () => {
    await lobbySocketWatch(mockSocket, mockServer)({ auth: auth1, payload: "nonexistent" });
    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketUnwatch", () => {
  it("leaves the lobby room", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketUnwatch(mockSocket, mockServer)({ auth: auth1, payload: lobby.lobbyId });

    expect(mockSocket.leave).toHaveBeenCalledWith(lobby.lobbyId);
    expect(logSocketError).not.toHaveBeenCalled();
  });
});

describe("socketJoin", () => {
  it("joins lobby and broadcasts lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketJoin(mockSocket, mockServer)({ auth: auth2, payload: lobby.lobbyId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
  });

  it("logs error when joining a private lobby without invite", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketJoin(mockSocket, mockServer)({ auth: auth2, payload: lobby.lobbyId });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketLeave", () => {
  it("leaves lobby and broadcasts lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const guest = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    await socketLeave(mockSocket, mockServer)({ auth: auth2, payload: lobby.lobbyId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
  });

  it("logs error when host tries to leave", async () => {
    const host = (await getUserByUsername("user1"))!;
    await createLobby(host, "nim", false, new Date());

    await socketLeave(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: (await createLobby(host, "nim", false, new Date())).lobbyId,
    });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketInvitePlayer", () => {
  it("invites player, broadcasts lobbyUpdated, and emits lobbyInviteReceived", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketInvitePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { lobbyId: lobby.lobbyId, username: "user2" },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    // Should broadcast lobbyUpdated to lobby room
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    // Should emit lobbyInviteReceived to the invited user's room
    expect(mockServer.to).toHaveBeenCalledWith("user:user2");
  });

  it("logs error when non-host tries to invite", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketInvitePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: { lobbyId: lobby.lobbyId, username: "user3" },
    });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketDeclineInvite", () => {
  it("declines invite and broadcasts lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    await socketDeclineInvite(mockSocket, mockServer)({ auth: auth2, payload: lobby.lobbyId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyUpdated",
      expect.objectContaining({ lobbyId: lobby.lobbyId }),
    );
  });
});

describe("socketRemovePlayer", () => {
  it("removes player and broadcasts lobbyUpdated", async () => {
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

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
  });

  it("logs error when non-host tries to remove", async () => {
    const host = (await getUserByUsername("user1"))!;
    const guest = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    await socketRemovePlayer(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: { lobbyId: lobby.lobbyId, username: "user1" },
    });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketUpdateSettings", () => {
  it("updates settings and broadcasts lobbyUpdated", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketUpdateSettings(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: {
        lobbyId: lobby.lobbyId,
        settings: { mode: "casual", difficulty: "hard", timerSeconds: 90 },
      },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
  });

  it("logs error when non-host updates settings", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    await socketUpdateSettings(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: {
        lobbyId: lobby.lobbyId,
        settings: { mode: "casual", difficulty: "normal", timerSeconds: null },
      },
    });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketUnwatch error path", () => {
  it("logs error for invalid auth", async () => {
    await socketUnwatch(
      mockSocket,
      mockServer,
    )({ auth: { username: "user1", password: "wrong" }, payload: "some-lobby" });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketDeclineInvite error path", () => {
  it("logs error when uninvited user declines", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await socketDeclineInvite(mockSocket, mockServer)({ auth: auth3, payload: lobby.lobbyId });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketStart success path", () => {
  it("broadcasts lobbyStarted on successful start", async () => {
    const host = (await getUserByUsername("user1"))!;
    const guest = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: lobby.lobbyId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(lobby.lobbyId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "lobbyStarted",
      expect.objectContaining({ lobbyId: lobby.lobbyId, gameId: expect.any(String) }),
    );
  });
});
