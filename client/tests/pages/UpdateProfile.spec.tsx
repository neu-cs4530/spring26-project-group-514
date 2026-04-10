import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UpdateProfile from "../../src/pages/UpdateProfile.tsx";

const mockedUseLoginContext = vi.hoisted(() => vi.fn());
const mockedUseAuth = vi.hoisted(() => vi.fn());
const mockedUseEditProfileForm = vi.hoisted(() => vi.fn());
const mockedGetLeaderboardOptOut = vi.hoisted(() => vi.fn());
const mockedGetPlayerStats = vi.hoisted(() => vi.fn());
const mockedSetLeaderboardOptOut = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useLoginContext", () => ({
  default: () => mockedUseLoginContext(),
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => mockedUseAuth(),
}));

vi.mock("../../src/hooks/useTimeSince", () => ({
  default: () => () => "1 day ago",
}));

vi.mock("../../src/hooks/useEditProfileForm", () => ({
  default: () => mockedUseEditProfileForm(),
}));

vi.mock("../../src/services/statsService.ts", () => ({
  getLeaderboardOptOut: (...args: unknown[]) => mockedGetLeaderboardOptOut(...args),
  getPlayerStats: (...args: unknown[]) => mockedGetPlayerStats(...args),
  setLeaderboardOptOut: (...args: unknown[]) => mockedSetLeaderboardOptOut(...args),
}));

describe("UpdateProfile page", () => {
  beforeEach(() => {
    mockedUseLoginContext.mockReturnValue({
      user: { username: "user1", display: "User One", createdAt: new Date() },
    });
    mockedUseAuth.mockReturnValue({ username: "user1", password: "pwd1111" });
    mockedUseEditProfileForm.mockReturnValue({
      display: "User One",
      setDisplay: vi.fn(),
      password: "",
      setPassword: vi.fn(),
      confirm: "",
      setConfirm: vi.fn(),
      err: null,
      handleSubmit: vi.fn(),
    });
    mockedGetLeaderboardOptOut.mockResolvedValue({ optOut: false });
    mockedGetPlayerStats.mockResolvedValue({
      username: "user1",
      display: "user1",
      wins: 4,
      losses: 1,
      gamesPlayed: 5,
      winRate: 0.8,
      badges: ["first_win", "leaderboard_placement"],
    });
    mockedSetLeaderboardOptOut.mockResolvedValue({ success: true });
  });

  it("shows personal stats and toggles leaderboard opt-out", async () => {
    render(<UpdateProfile />);

    await screen.findByText("Personal Stats");
    screen.getByText("Total Wins: 4");
    screen.getByText("first_win, leaderboard_placement");

    const checkbox = screen.getByLabelText("Hide me from the public leaderboard");
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockedSetLeaderboardOptOut).toHaveBeenCalledExactlyOnceWith(
        { username: "user1", password: "pwd1111" },
        true,
      );
    });
  });
});
