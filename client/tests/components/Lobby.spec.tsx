import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Lobby from "../../src/pages/Lobby.tsx";

const mockedUseNavigate = vi.fn();
const mockedInvitePlayer = vi.fn();
const mockedRemovePlayer = vi.fn();
const mockedJoinLobby = vi.fn();
const mockedLeaveLobby = vi.fn();
const mockedDeclineInvite = vi.fn();
const mockedUpdateSettings = vi.fn();
const mockedStartLobby = vi.fn();

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...mod,
    useNavigate: () => mockedUseNavigate,
    useParams: () => ({ lobbyId: "lobby-123" }),
  };
});

vi.mock("../../src/hooks/useFriendList.ts", () => ({
  default: () => ({
    friends: [{ username: "friend1", display: "Friend One", createdAt: new Date("2025-01-01") }],
  }),
}));

vi.mock("../../src/components/UserLink.tsx", () => ({
  default: ({ user }: { user: { username: string } }) => <span>{user.username}</span>,
}));

vi.mock("../../src/components/ChatPanel.tsx", () => ({
  default: ({ chatId }: { chatId: string }) => <div>chat:{chatId}</div>,
}));

vi.mock("../../src/hooks/useSocketsForLobby.ts", () => ({
  default: () => ({
    lobby: {
      lobbyId: "lobby-123",
      type: "nim",
      isPrivate: true,
      code: "ABCD12",
      createdBy: { username: "user1", display: "User One", createdAt: new Date("2025-01-01") },
      players: [
        {
          user: { username: "user1", display: "User One", createdAt: new Date("2025-01-01") },
          status: "joined",
        },
        {
          user: { username: "user2", display: "User Two", createdAt: new Date("2025-01-01") },
          status: "pending",
        },
      ],
      settings: { mode: "standard", difficulty: "normal", timerSeconds: null },
      chatId: "chat-1",
      createdAt: new Date("2025-01-01"),
    },
    isHost: true,
    me: {
      user: { username: "user1", display: "User One", createdAt: new Date("2025-01-01") },
      status: "joined",
    },
    startedGameId: null,
    joinLobby: mockedJoinLobby,
    leaveLobby: mockedLeaveLobby,
    declineInvite: mockedDeclineInvite,
    invitePlayer: mockedInvitePlayer,
    removePlayer: mockedRemovePlayer,
    updateSettings: mockedUpdateSettings,
    startLobby: mockedStartLobby,
  }),
}));

describe("Lobby page", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    mockedInvitePlayer.mockReset();
    mockedRemovePlayer.mockReset();
    mockedJoinLobby.mockReset();
    mockedLeaveLobby.mockReset();
    mockedDeclineInvite.mockReset();
    mockedUpdateSettings.mockReset();
    mockedStartLobby.mockReset();
  });

  it("renders lobby details and chat", () => {
    render(<Lobby />);

    expect(screen.getByText("nim Lobby")).toBeInTheDocument();
    expect(screen.getByText("Code: ABCD12")).toBeInTheDocument();
    expect(screen.getByText("chat:chat-1")).toBeInTheDocument();
  });

  it("invites by username input and friend quick-invite", () => {
    render(<Lobby />);

    fireEvent.change(screen.getByLabelText("Invite username"), { target: { value: "user3" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(mockedInvitePlayer).toHaveBeenCalledWith("user3");

    fireEvent.click(screen.getByRole("button", { name: "Invite Friend" }));
    expect(mockedInvitePlayer).toHaveBeenCalledWith("friend1");
  });
});
