import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LobbyList from "../../src/pages/LobbyList.tsx";
import type { joinLobbyByCode as joinLobbyByCodeFn } from "../../src/services/lobbyService.ts";

const mockedUseNavigate = vi.fn();
const mockedJoinLobbyByCode = vi.fn<typeof joinLobbyByCodeFn>();

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedUseNavigate };
});

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "user1", password: "pwd1111" }),
}));

vi.mock("../../src/hooks/useLobbyList.ts", () => ({
  default: () => [
    {
      lobbyId: "lobby-abc",
      type: "guess",
      isPrivate: false,
      code: "CODE99",
      createdBy: { username: "host", display: "Host", createdAt: new Date("2025-01-01") },
      players: [
        {
          user: { username: "host", display: "Host", createdAt: new Date("2025-01-01") },
          status: "joined",
        },
      ],
      settings: { mode: "standard", difficulty: "normal", timerSeconds: null },
      chatId: "chat-22",
      createdAt: new Date("2025-01-01"),
    },
  ],
}));

vi.mock("../../src/services/lobbyService.ts", () => ({
  joinLobbyByCode: (
    ...args: Parameters<typeof mockedJoinLobbyByCode>
  ): ReturnType<typeof mockedJoinLobbyByCode> => mockedJoinLobbyByCode(...args),
}));

describe("LobbyList page", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    mockedJoinLobbyByCode.mockReset();
  });

  it("opens a selected lobby from the list", () => {
    render(<LobbyList />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(mockedUseNavigate).toHaveBeenCalledWith("/lobby/lobby-abc");
  });

  it("joins by code and navigates to lobby", async () => {
    mockedJoinLobbyByCode.mockResolvedValue({ lobbyId: "lobby-join" });
    render(<LobbyList />);

    fireEvent.change(screen.getByLabelText("Lobby code"), { target: { value: " abcd12 " } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => {
      expect(mockedJoinLobbyByCode).toHaveBeenCalledExactlyOnceWith(
        { username: "user1", password: "pwd1111" },
        "ABCD12",
      );
    });

    expect(mockedUseNavigate).toHaveBeenCalledWith("/lobby/lobby-join");
  });
});
