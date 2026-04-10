import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Friends from "../../src/pages/Friends.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { FriendRequest, SafeUserInfo } from "@gamenite/shared";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

const mockedUseFriendList = vi.hoisted(() => vi.fn());
const mockedUseFriendRequests = vi.hoisted(() => vi.fn());
const mockedUseBlockList = vi.hoisted(() => vi.fn());
const mockedUseActionError = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useFriendList.ts", () => ({ default: mockedUseFriendList }));
vi.mock("../../src/hooks/useFriendRequests.ts", () => ({ default: mockedUseFriendRequests }));
vi.mock("../../src/hooks/useBlockList.ts", () => ({ default: mockedUseBlockList }));
vi.mock("../../src/hooks/useActionError.ts", () => ({ default: mockedUseActionError }));

const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as GameSocket;
const currentUser: SafeUserInfo = {
  username: "user1",
  display: "User One",
  createdAt: new Date("2025-01-01"),
};
const friend: SafeUserInfo = {
  username: "user2",
  display: "Sénior Dos",
  createdAt: new Date("2025-01-01"),
};

const incomingReq: FriendRequest = {
  id: "req-1",
  fromUser: friend,
  toUser: currentUser,
  status: "pending",
  createdAt: new Date("2025-01-01"),
};

const removeFriend = vi.fn();
const sendRequest = vi.fn();
const acceptRequest = vi.fn();
const declineRequest = vi.fn();
const unblockUser = vi.fn();
const setActionError = vi.fn();

function renderPage() {
  render(
    <MemoryRouter>
      <LoginContext
        value={{ user: currentUser, pass: "pwd1111", socket: mockSocket, reset: vi.fn() }}
      >
        <Friends />
      </LoginContext>
    </MemoryRouter>,
  );
}

describe("Friends page", () => {
  beforeEach(() => {
    removeFriend.mockReset();
    sendRequest.mockReset();
    acceptRequest.mockReset();
    declineRequest.mockReset();
    unblockUser.mockReset();
    setActionError.mockReset();

    mockedUseFriendList.mockReturnValue({
      friends: { message: "No friends yet..." },
      removeFriend,
    });
    mockedUseFriendRequests.mockReturnValue({
      incoming: { message: "No incoming requests." },
      outgoing: { message: "No outgoing requests." },
      sendRequest,
      acceptRequest,
      declineRequest,
    });
    mockedUseBlockList.mockReturnValue({ blockedUsers: [], blockError: null, unblockUser });
    mockedUseActionError.mockReturnValue({ actionError: null, setActionError });
  });

  it("shows 'No friends yet...' when the friends list is empty", () => {
    renderPage();
    expect(screen.getByText("No friends yet...")).not.toBeNull();
  });

  it("renders a friend entry when the friends list is non-empty", () => {
    mockedUseFriendList.mockReturnValue({ friends: [friend], removeFriend });
    renderPage();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
  });

  it("shows the remove confirmation modal when Remove is clicked on a friend", () => {
    mockedUseFriendList.mockReturnValue({ friends: [friend], removeFriend });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.getByText(/are you sure you want to remove/i)).not.toBeNull();
  });

  it("calls removeFriend and closes the modal when the removal is confirmed", async () => {
    removeFriend.mockResolvedValue(null);
    mockedUseFriendList.mockReturnValue({ friends: [friend], removeFriend });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, remove/i }));
    await waitFor(() => {
      expect(removeFriend).toHaveBeenCalledExactlyOnceWith("user2");
      expect(screen.queryByText(/are you sure you want to remove/i)).toBeNull();
    });
  });

  it("closes the modal without calling removeFriend when cancelled", async () => {
    mockedUseFriendList.mockReturnValue({ friends: [friend], removeFriend });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));
    await waitFor(() => expect(screen.queryByText(/are you sure you want to remove/i)).toBeNull());
    expect(removeFriend).not.toHaveBeenCalled();
  });

  it("shows 'No incoming requests.' when there are none", () => {
    renderPage();
    expect(screen.getByText("No incoming requests.")).not.toBeNull();
  });

  it("renders an incoming friend request when one is present", () => {
    mockedUseFriendRequests.mockReturnValue({
      incoming: [incomingReq],
      outgoing: { message: "No outgoing requests." },
      sendRequest,
      acceptRequest,
      declineRequest,
    });
    renderPage();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
  });

  it("calls acceptRequest when the accept button on an incoming request is clicked", () => {
    // With one incoming request and no friends, the sole listitem belongs to FriendRequestView.
    // The accept button is the first button within that listitem.
    mockedUseFriendRequests.mockReturnValue({
      incoming: [incomingReq],
      outgoing: { message: "No outgoing requests." },
      sendRequest,
      acceptRequest,
      declineRequest,
    });
    renderPage();
    const [acceptBtn] = within(screen.getByRole("listitem")).getAllByRole("button");
    fireEvent.click(acceptBtn);
    expect(acceptRequest).toHaveBeenCalledExactlyOnceWith("req-1");
  });

  it("calls declineRequest when the decline button on an incoming request is clicked", () => {
    mockedUseFriendRequests.mockReturnValue({
      incoming: [incomingReq],
      outgoing: { message: "No outgoing requests." },
      sendRequest,
      acceptRequest,
      declineRequest,
    });
    renderPage();
    const [, declineBtn] = within(screen.getByRole("listitem")).getAllByRole("button");
    fireEvent.click(declineBtn);
    expect(declineRequest).toHaveBeenCalledExactlyOnceWith("req-1");
  });

  it("shows 'No outgoing requests.' when there are none", () => {
    renderPage();
    expect(screen.getByText("No outgoing requests.")).not.toBeNull();
  });

  it("shows 'No blocked users.' when there are none", () => {
    renderPage();
    expect(screen.getByText("No blocked users.")).not.toBeNull();
  });

  it("renders a blocked user with an Unblock button when present", () => {
    mockedUseBlockList.mockReturnValue({ blockedUsers: [friend], blockError: null, unblockUser });
    renderPage();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
    expect(screen.getByRole("button", { name: /unblock/i })).not.toBeNull();
  });

  it("calls unblockUser when Unblock is clicked", () => {
    unblockUser.mockResolvedValue(null);
    mockedUseBlockList.mockReturnValue({ blockedUsers: [friend], blockError: null, unblockUser });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    expect(unblockUser).toHaveBeenCalledExactlyOnceWith("user2");
  });
});
