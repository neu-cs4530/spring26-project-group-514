import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Lobby from "../../src/pages/Lobby.tsx";

const mockedUseNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...mod,
    useParams: () => ({ lobbyId: "lobby-123" }),
    useNavigate: () => mockedUseNavigate,
  };
});

const socketActions = {
  joinLobby: vi.fn(),
  leaveLobby: vi.fn(),
  declineInvite: vi.fn(),
  invitePlayer: vi.fn(),
  removePlayer: vi.fn(),
  updateSettings: vi.fn(),
  startLobby: vi.fn(),
};

vi.mock("../../src/hooks/useSocketsForLobby.ts", () => ({
  default: () => ({
    lobby: {
      lobbyId: "lobby-123",
      type: "nim",
      isPrivate: true,
      code: "ABC12345",
      createdBy: { username: "host", display: "Host", createdAt: new Date("2026-01-01") },
      settings: { mode: "standard", difficulty: "normal", timerSeconds: 60 },
      chatId: "chat-1",
      players: [
        {
          user: { username: "host", display: "Host", createdAt: new Date("2026-01-01") },
          status: "joined",
        },
      ],
      createdAt: new Date("2026-01-01"),
    },
    isHost: true,
    me: {
      user: { username: "host", display: "Host", createdAt: new Date("2026-01-01") },
      status: "joined",
    },
    startedGameId: null,
    ...socketActions,
  }),
}));

vi.mock("../../src/hooks/useFriendList.ts", () => ({
  default: () => ({
    friends: [{ username: "friend1", display: "Friend One", createdAt: new Date() }],
  }),
}));

vi.mock("../../src/components/UserLink.tsx", () => ({
  default: ({ user }: { user: { username: string } }) => <span>{user.username}</span>,
}));

vi.mock("../../src/components/ChatPanel.tsx", () => ({
  default: () => <div>Chat panel</div>,
}));

describe("Lobby page", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    socketActions.joinLobby.mockReset();
    socketActions.leaveLobby.mockReset();
    socketActions.declineInvite.mockReset();
    socketActions.invitePlayer.mockReset();
    socketActions.removePlayer.mockReset();
    socketActions.updateSettings.mockReset();
    socketActions.startLobby.mockReset();
    localStorage.clear();
  });

  it("copies lobby invite link", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<Lobby />);
    fireEvent.click(screen.getByText("Copy Link"));

    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/lobby/lobby-123`);
  });

  it("toggles no timer mode and updates lobby settings", () => {
    render(<Lobby />);

    fireEvent.click(screen.getByLabelText("No Timer Mode"));

    expect(socketActions.updateSettings).toHaveBeenCalledExactlyOnceWith({
      mode: "standard",
      difficulty: "normal",
      timerSeconds: null,
    });
  });

  it("applies a saved timer preset", () => {
    localStorage.setItem(
      "gamenite:lobbyTimerPresets",
      JSON.stringify([
        { name: "quick match", seconds: 30 },
        { name: "standard", seconds: 60 },
      ]),
    );

    render(<Lobby />);

    fireEvent.change(screen.getByLabelText("Timer preset"), { target: { value: "30" } });

    expect(socketActions.updateSettings).toHaveBeenCalledExactlyOnceWith({
      mode: "standard",
      difficulty: "normal",
      timerSeconds: 30,
    });
  });

  it("invites a player from the username field", () => {
    render(<Lobby />);

    fireEvent.change(screen.getByLabelText("Invite username"), { target: { value: "friend2" } });
    fireEvent.click(screen.getByText("Invite"));

    expect(socketActions.invitePlayer).toHaveBeenCalledExactlyOnceWith("friend2");
  });
});
