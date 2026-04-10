import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GameServer } from "../src/types.ts";
import { clearGameTimer, maybeStartGameTimer } from "../src/controllers/gameTimer.ts";

const mockedGetGameTimer = vi.hoisted(() => vi.fn());
const mockedGetGameScores = vi.hoisted(() => vi.fn());
const mockedExpireGameByTimer = vi.hoisted(() => vi.fn());

vi.mock("../src/services/game.service.ts", () => ({
  getGameTimer: mockedGetGameTimer,
  getGameScores: mockedGetGameScores,
  expireGameByTimer: mockedExpireGameByTimer,
}));

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const mockServer = new MockGameServer() as unknown as GameServer;

beforeEach(() => {
  vi.useFakeTimers();
  mockedGetGameTimer.mockReset();
  mockedGetGameScores.mockReset();
  mockedExpireGameByTimer.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  clearGameTimer("game-1");
  vi.clearAllMocks();
});

describe("gameTimer helper", () => {
  it("does nothing when no timer is running", async () => {
    mockedGetGameTimer.mockResolvedValue(null);

    await maybeStartGameTimer(mockServer, "game-1");

    expect(mockServer.emit).not.toHaveBeenCalled();
  });

  it("broadcasts timer updates and expiration events", async () => {
    mockedGetGameTimer
      .mockResolvedValueOnce({ gameId: "game-1", remainingSeconds: 1, isRunning: true })
      .mockResolvedValueOnce({ gameId: "game-1", remainingSeconds: 0, isRunning: false });
    mockedGetGameScores.mockResolvedValue({
      gameId: "game-1",
      scores: [{ playerIndex: 0, score: 7 }],
    });
    mockedExpireGameByTimer.mockResolvedValue({
      views: {
        watchers: { type: "nim", view: { remaining: 0, nextPlayer: 0 } },
        players: [],
      },
      moveDescription: "timer expired",
      chatId: "chat-1",
      done: true,
    });

    await maybeStartGameTimer(mockServer, "game-1");

    expect(mockServer.emit).toHaveBeenCalledWith("gameTimerStarted", {
      gameId: "game-1",
      remainingSeconds: 1,
      isRunning: true,
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockServer.emit).toHaveBeenCalledWith("gameTimerUpdated", {
      gameId: "game-1",
      remainingSeconds: 0,
      isRunning: false,
    });
    expect(mockServer.emit).toHaveBeenCalledWith("gameStateUpdated", {
      type: "nim",
      view: { remaining: 0, nextPlayer: 0 },
      forPlayer: false,
    });
    expect(mockServer.emit).toHaveBeenCalledWith("gameScoresUpdated", {
      gameId: "game-1",
      scores: [{ playerIndex: 0, score: 7 }],
    });
    expect(mockedExpireGameByTimer).toHaveBeenCalledExactlyOnceWith("game-1");
  });
});
