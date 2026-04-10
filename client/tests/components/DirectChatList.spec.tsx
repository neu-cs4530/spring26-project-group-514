import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DirectChatList from "../../src/pages/DirectChatList.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { DirectChatSummary, SafeUserInfo } from "@gamenite/shared";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));
vi.mock("../../src/hooks/useNotifications.ts", () => ({
  default: () => ({
    dmUnreads: {},
    dmLastMessageAt: {},
    friendRequestCount: 0,
    totalUnreadMessages: 0,
    markDmRead: vi.fn(),
    clearActiveDm: vi.fn(),
  }),
}));

const mockedUseDirectChatList = vi.hoisted(() => vi.fn());
vi.mock("../../src/hooks/useDirectChatList.ts", () => ({ default: mockedUseDirectChatList }));

const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as GameSocket;
const currentUser: SafeUserInfo = {
  username: "user1",
  display: "User One",
  createdAt: new Date("2025-01-01"),
};
const otherUser: SafeUserInfo = {
  username: "user2",
  display: "Sénior Dos",
  createdAt: new Date("2025-01-01"),
};

const chat: DirectChatSummary = {
  directChatId: "dm-1",
  participants: [currentUser, otherUser],
  createdAt: new Date("2025-01-01"),
  unreadCount: 0,
  lastMessageAt: null,
};

function renderPage() {
  render(
    <MemoryRouter>
      <LoginContext
        value={{ user: currentUser, pass: "pwd1111", socket: mockSocket, reset: vi.fn() }}
      >
        <DirectChatList />
      </LoginContext>
    </MemoryRouter>,
  );
}

describe("DirectChatList page", () => {
  beforeEach(() => {
    mockedUseDirectChatList.mockReturnValue({ message: "Loading..." });
  });

  it("shows 'Loading...' while conversations are being fetched", () => {
    renderPage();
    expect(screen.getByText("Loading...")).not.toBeNull();
  });

  it("shows 'No conversations yet...' when there are no DMs", () => {
    mockedUseDirectChatList.mockReturnValue({ message: "No conversations yet..." });
    renderPage();
    expect(screen.getByText("No conversations yet...")).not.toBeNull();
  });

  it("renders a conversation entry when DMs are present", () => {
    mockedUseDirectChatList.mockReturnValue([chat]);
    renderPage();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
  });

  it("renders a link to the correct DM page for each conversation", () => {
    mockedUseDirectChatList.mockReturnValue([chat]);
    renderPage();
    expect(screen.getByRole("listitem").getAttribute("href")).toBe("/dm/dm-1");
  });
});
