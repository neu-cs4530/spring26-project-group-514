import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import FriendRequestView from "../../src/components/FriendRequestView.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { FriendRequest, SafeUserInfo } from "@gamenite/shared";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
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

const incomingRequest: FriendRequest = {
  id: "req-1",
  fromUser: otherUser,
  toUser: currentUser,
  status: "pending",
  createdAt: new Date("2025-01-01"),
};

const outgoingRequest: FriendRequest = {
  id: "req-2",
  fromUser: currentUser,
  toUser: otherUser,
  status: "pending",
  createdAt: new Date("2025-01-01"),
};

const loginContextValue = {
  user: currentUser,
  pass: "pwd1111",
  socket: mockSocket,
  reset: vi.fn(),
};

describe("FriendRequestView component", () => {
  describe("incoming direction", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();

    beforeEach(() => {
      onAccept.mockReset();
      onDecline.mockReset();
      render(
        <MemoryRouter>
          <LoginContext value={loginContextValue}>
            <FriendRequestView
              request={incomingRequest}
              direction="incoming"
              onAccept={onAccept}
              onDecline={onDecline}
            />
          </LoginContext>
        </MemoryRouter>,
      );
    });

    it("shows the sender's display name", () => {
      expect(screen.getByText("Sénior Dos")).not.toBeNull();
    });

    it("calls onAccept with the request id when the accept button is clicked", () => {
      fireEvent.click(screen.getAllByRole("button")[0]);
      expect(onAccept).toHaveBeenCalledExactlyOnceWith("req-1");
    });

    it("calls onDecline with the request id when the decline button is clicked", () => {
      fireEvent.click(screen.getAllByRole("button")[1]);
      expect(onDecline).toHaveBeenCalledExactlyOnceWith("req-1");
    });
  });

  describe("outgoing direction", () => {
    beforeEach(() => {
      render(
        <MemoryRouter>
          <LoginContext value={loginContextValue}>
            <FriendRequestView request={outgoingRequest} direction="outgoing" />
          </LoginContext>
        </MemoryRouter>,
      );
    });

    it("shows the recipient's display name", () => {
      expect(screen.getByText("Sénior Dos")).not.toBeNull();
    });

    it("shows a pending indicator and no action buttons", () => {
      expect(screen.getByText(/pending/i)).not.toBeNull();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });
});
