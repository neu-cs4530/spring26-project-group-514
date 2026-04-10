import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";

import GamePanel from "../../src/components/GamePanel.tsx";

const mockedUseLoginContext = vi.hoisted(() => vi.fn());
const mockedUseSocketsForGame = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: mockedUseLoginContext,
}));

vi.mock("../../src/hooks/useSocketsForGame.ts", () => ({
  default: mockedUseSocketsForGame,
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "2 hours ago",
}));

vi.mock("../../src/games/GameDispatch.tsx", () => ({
  default: () => <div>Game dispatch</div>,
}));

vi.mock("../../src/components/UserLink.tsx", () => ({
  default: ({ user }: { user: { username: string } }) => <span>{user.username}</span>,
}));

describe("GamePanel", () => {
  beforeEach(() => {
    mockedUseLoginContext.mockReturnValue({ user: { username: "user1" } });
    mockedUseSocketsForGame.mockReturnValue({
      view: { type: "nim", view: { remaining: 0, nextPlayer: 0 } },
      players: [
        { username: "user1", display: "User One", createdAt: new Date() },
        { username: "user2", display: "User Two", createdAt: new Date() },
      ],
      scores: [
        { playerIndex: 0, score: 5 },
        { playerIndex: 1, score: 3 },
      ],
      timer: { gameId: "game-1", remainingSeconds: 0, isRunning: false },
      timerStartedSignal: 0,
      userPlayerIndex: 0,
      hasWatched: true,
      joinGame: vi.fn(),
      startGame: vi.fn(),
    });
  });

  it("shows leaderboard scores and the timer-ended notice", () => {
    render(
      <GamePanel
        gameId="game-1"
        type="nim"
        players={[]}
        createdAt={new Date("2026-04-10T00:00:00.000Z")}
        isPrivate={false}
        chat="chat-1"
        createdBy={{ username: "host", display: "Host", createdAt: new Date() }}
        minPlayers={2}
        status="active"
      />,
    );

    screen.getByText("Leaderboard Scores");
    screen.getByText("Total wins so far for each player");
    screen.getByText("5");
    screen.getByText("3");
    screen.getByText("Match Timer has Ended");
  });

  it("shows the timer-started notice when the timer begins", () => {
    mockedUseSocketsForGame.mockReturnValueOnce({
      view: { type: "nim", view: { remaining: 0, nextPlayer: 0 } },
      players: [
        { username: "user1", display: "User One", createdAt: new Date() },
        { username: "user2", display: "User Two", createdAt: new Date() },
      ],
      scores: [],
      timer: { gameId: "game-1", remainingSeconds: 30, isRunning: true },
      timerStartedSignal: Date.now(),
      userPlayerIndex: 0,
      hasWatched: true,
      joinGame: vi.fn(),
      startGame: vi.fn(),
    });

    render(
      <GamePanel
        gameId="game-1"
        type="nim"
        players={[]}
        createdAt={new Date("2026-04-10T00:00:00.000Z")}
        isPrivate={false}
        chat="chat-1"
        createdBy={{ username: "host", display: "Host", createdAt: new Date() }}
        minPlayers={2}
        status="active"
      />,
    );

    screen.getByText("Timer started");
  });
});
