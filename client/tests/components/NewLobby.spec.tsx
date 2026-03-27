import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewLobby from "../../src/pages/NewLobby.tsx";
import type { createLobby as createLobbyFn } from "../../src/services/lobbyService.ts";
import type { LobbyInfo } from "@gamenite/shared";

const mockedUseNavigate = vi.fn();
const mockedCreateLobby = vi.fn<typeof createLobbyFn>();

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedUseNavigate };
});

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "user1", password: "pwd1111" }),
}));

vi.mock("../../src/services/lobbyService.ts", () => ({
  createLobby: (
    ...args: Parameters<typeof mockedCreateLobby>
  ): ReturnType<typeof mockedCreateLobby> => mockedCreateLobby(...args),
}));

describe("NewLobby page", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    mockedCreateLobby.mockReset();
  });

  it("shows validation error when no game is selected", async () => {
    render(<NewLobby />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Please select a game type")).toBeTruthy();
    expect(mockedCreateLobby).not.toHaveBeenCalled();
  });

  it("creates a lobby and navigates to it", async () => {
    const createdLobby: LobbyInfo = {
      lobbyId: "lobby-123",
      type: "nim",
      isPrivate: true,
      code: "NIM123",
      createdBy: { username: "user1", display: "User One", createdAt: new Date("2025-01-01") },
      players: [
        {
          user: { username: "user1", display: "User One", createdAt: new Date("2025-01-01") },
          status: "joined",
        },
      ],
      settings: { mode: "standard", difficulty: "normal", timerSeconds: null },
      chatId: "chat-123",
      createdAt: new Date("2025-01-01"),
    };
    mockedCreateLobby.mockResolvedValue(createdLobby);
    render(<NewLobby />);

    fireEvent.change(screen.getByLabelText("Game selection"), { target: { value: "nim" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockedCreateLobby).toHaveBeenCalledExactlyOnceWith(
        { username: "user1", password: "pwd1111" },
        { type: "nim", isPrivate: true },
      );
    });

    expect(mockedUseNavigate).toHaveBeenCalledExactlyOnceWith("/lobby/lobby-123");
  });
});
