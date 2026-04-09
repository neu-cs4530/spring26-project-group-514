import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { socketWatch } from "../src/controllers/game.controller.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createGame, joinGame, startGame } from "../src/services/game.service.ts";

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
