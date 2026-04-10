import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ViewProfile from "../../src/pages/ViewProfile.tsx";

const mockedUseAuth = vi.hoisted(() => vi.fn());
const mockedUseTimeSince = vi.hoisted(() => vi.fn());
const mockedGetUserById = vi.hoisted(() => vi.fn());
const mockedGetPlayerStats = vi.hoisted(() => vi.fn());
const mockedGetMatchHistory = vi.hoisted(() => vi.fn());
const mockedUseBlockList = vi.hoisted(() => vi.fn());
const mockedUseFriendList = vi.hoisted(() => vi.fn());
const mockedUseFriendRequests = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => mockedUseAuth(),
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => mockedUseTimeSince(),
}));

vi.mock("../../src/services/userService", () => ({
  getUserById: (...args: unknown[]) => mockedGetUserById(...args),
}));

vi.mock("../../src/services/statsService.ts", () => ({
  getPlayerStats: (...args: unknown[]) => mockedGetPlayerStats(...args),
  getMatchHistory: (...args: unknown[]) => mockedGetMatchHistory(...args),
}));

vi.mock("../../src/hooks/useBlockList.ts", () => ({
  default: () => mockedUseBlockList(),
}));

vi.mock("../../src/hooks/useFriendList.ts", () => ({
  default: () => mockedUseFriendList(),
}));

vi.mock("../../src/hooks/useFriendRequests.ts", () => ({
  default: () => mockedUseFriendRequests(),
}));

vi.mock("../../src/components/ConfirmModal", () => ({
  default: () => <div>Confirm modal</div>,
}));

vi.mock("../../src/components/Icons", () => ({
  BlockedIcon: () => <span>Blocked</span>,
  CheckIcon: () => <span>Check</span>,
  CrossIcon: () => <span>Cross</span>,
}));

describe("ViewProfile page", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ username: "user1", password: "pwd1111" });
    mockedUseTimeSince.mockReturnValue(() => "2 days ago");
    mockedGetUserById.mockResolvedValue({
      username: "user2",
      display: "User Two",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    mockedGetPlayerStats.mockImplementation(async (username: string) => {
      if (username === "user1") {
        return {
          username: "user1",
          display: "user1",
          wins: 3,
          losses: 2,
          gamesPlayed: 5,
          winRate: 0.6,
          badges: ["first_win"],
        };
      }
      return {
        username: "user2",
        display: "user2",
        wins: 5,
        losses: 1,
        gamesPlayed: 6,
        winRate: 5 / 6,
        badges: ["first_win", "ten_wins"],
      };
    });
    mockedGetMatchHistory.mockResolvedValue({
      data: [
        {
          gameId: "game-1",
          type: "nim",
          players: ["user1", "user2"],
          result: "win",
          endedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 5,
      totalPages: 1,
    });
    mockedUseBlockList.mockReturnValue({
      blockedSet: new Set<string>(),
      blockUser: vi.fn(),
      unblockUser: vi.fn(),
    });
    mockedUseFriendList.mockReturnValue({
      friends: [{ username: "user2", display: "User Two", createdAt: new Date() }],
    });
    mockedUseFriendRequests.mockReturnValue({
      incoming: [],
      outgoing: [],
      sendRequest: vi.fn(),
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
    });
  });

  it("shows public stats, recent matches, and friend comparison", async () => {
    render(<ViewProfile username="user2" />);

    await screen.findByText("Profile for User Two");
    screen.getByText("Stats");
    screen.getByText("Total Wins: 5");
    screen.getByText("Total Losses: 1");
    screen.getByText("Games Played: 6");
    screen.getByText("first_win, ten_wins");
    screen.getByText("Recent Matches");
    screen.getByText("Opponents: user1");
    screen.getByText("Friend Comparison");
    screen.getByText("3");
    screen.getByText("5");
  });
});
