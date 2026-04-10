import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DirectChatSummaryView from "../../src/components/DirectChatSummaryView.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { DirectChatSummary, SafeUserInfo } from "@gamenite/shared";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

const mockedUseNotifications = vi.hoisted(() => vi.fn());
vi.mock("../../src/hooks/useNotifications.ts", () => ({
  default: mockedUseNotifications,
}));

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

const baseNotifications = {
  dmUnreads: {} as Record<string, number>,
  dmLastMessageAt: {} as Record<string, Date>,
  friendRequestCount: 0,
  totalUnreadMessages: 0,
  markDmRead: vi.fn(),
  clearActiveDm: vi.fn(),
};

function renderComponent() {
  render(
    <MemoryRouter>
      <LoginContext
        value={{ user: currentUser, pass: "pwd1111", socket: mockSocket, reset: vi.fn() }}
      >
        <DirectChatSummaryView {...chat} />
      </LoginContext>
    </MemoryRouter>,
  );
}

describe("DirectChatSummaryView component", () => {
  beforeEach(() => {
    mockedUseNotifications.mockReturnValue({ ...baseNotifications, dmUnreads: {} });
  });

  it("displays the other participant's display name, not the logged-in user's", () => {
    renderComponent();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
    expect(screen.queryByText("User One")).toBeNull();
  });

  it("shows an unread message badge when there are unread messages", () => {
    mockedUseNotifications.mockReturnValue({ ...baseNotifications, dmUnreads: { "dm-1": 3 } });
    renderComponent();
    expect(screen.getByText("3")).not.toBeNull();
  });

  it("does not show a badge when there are no unread messages", () => {
    renderComponent();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("links to the correct DM conversation page", () => {
    renderComponent();
    expect(screen.getByRole("listitem").getAttribute("href")).toBe("/dm/dm-1");
  });
});
