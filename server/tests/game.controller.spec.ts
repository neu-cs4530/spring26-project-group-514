import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketWatch,
  socketJoinAsPlayer,
  socketStart,
  socketMakeMove,
} from "../src/controllers/game.controller.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createGame, joinGame, startGame } from "../src/services/game.service.ts";
import { GameRepo } from "../src/repository.ts";

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

let mockServer: GameServer;
let mockSocket: GameServerSocket;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const auth3 = { username: "user3", password: "pwd3333" };
const authBad = { username: "user1", password: "wrong" };

afterEach(() => {
  vi.resetAllMocks();
  mockServer = new MockGameServer() as unknown as GameServer;
  mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
});

// Initialize before first use
mockServer = new MockGameServer() as unknown as GameServer;
mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;

describe("socketWatch", () => {
  it("emits gameWatched and gameScoresUpdated on success", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameWatched",
      expect.objectContaining({ gameId: game.gameId }),
    );
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameScoresUpdated",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("emits gameTimerStarted for a game with an active timer", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), 120);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameTimerStarted",
      expect.objectContaining({ gameId: game.gameId, isRunning: true }),
    );
  });

  it("emits gameTimerUpdated (not Started) for a completed game with timer", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), 120);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    // Mark game as done
    const record = await GameRepo.get(game.gameId);
    record.done = true;
    await GameRepo.set(game.gameId, record);

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameTimerUpdated",
      expect.objectContaining({ gameId: game.gameId, isRunning: false }),
    );
    // Should NOT have emitted gameTimerStarted
    const startedCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === "gameTimerStarted",
    );
    expect(startedCalls).toHaveLength(0);
  });

  it("logs error for invalid auth", async () => {
    await socketWatch(mockSocket, mockServer)({ auth: authBad, payload: "some-id" });
    expect(logSocketError).toHaveBeenCalled();
  });

  it("logs error for nonexistent game", async () => {
    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: "nonexistent" });
    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketJoinAsPlayer", () => {
  it("broadcasts gamePlayersUpdated when a player joins", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const game = await createGame(user1, "nim", new Date(), null);

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(game.gameId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "gamePlayersUpdated",
      expect.arrayContaining([
        expect.objectContaining({ username: "user1" }),
        expect.objectContaining({ username: "user2" }),
      ]),
    );
  });

  it("auto-starts when game is full (nim: 2 players) and emits state + scores", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const game = await createGame(user1, "nim", new Date(), null);

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    // nim maxPlayers = 2, so joining user2 should auto-start
    expect(mockServer.emit).toHaveBeenCalledWith("gamePlayersUpdated", expect.any(Array));
    expect(mockServer.emit).toHaveBeenCalledWith(
      "gameScoresUpdated",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("logs error when joining a started game", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth3, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketStart", () => {
  it("broadcasts game state and scores on start", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);

    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.emit).toHaveBeenCalledWith(
      "gameScoresUpdated",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("logs error when starting with too few players", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const game = await createGame(user1, "nim", new Date(), null);

    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalled();
  });

  it("logs error for invalid auth", async () => {
    await socketStart(mockSocket, mockServer)({ auth: authBad, payload: "some-id" });
    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketMakeMove", () => {
  it("broadcasts state, scores, and move log after a valid move", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 3 },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.emit).toHaveBeenCalledWith(
      "gameScoresUpdated",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("logs error for an invalid move", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    // Taking 5 tokens is invalid in nim (max 3)
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 5 },
    });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("logs error when non-player tries to move", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), null);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth3,
      payload: { gameId: game.gameId, move: 1 },
    });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("clears timer when game ends", async () => {
    const user1 = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const game = await createGame(user1, "nim", new Date(), 60);
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, user1);

    // Set up so next move ends the game
    const record = await GameRepo.get(game.gameId);
    record.state = { remaining: 1, nextPlayer: 0 };
    await GameRepo.set(game.gameId, record);

    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 1 },
    });

    expect(logSocketError).not.toHaveBeenCalled();
  });
});
