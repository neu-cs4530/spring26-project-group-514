import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import FriendSummaryView from "../../src/components/FriendSummaryView.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { SafeUserInfo } from "@gamenite/shared";

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
const onRemove = vi.fn();

function renderComponent() {
  render(
    <MemoryRouter>
      <LoginContext
        value={{ user: currentUser, pass: "pwd1111", socket: mockSocket, reset: vi.fn() }}
      >
        <FriendSummaryView {...friend} onRemove={onRemove} />
      </LoginContext>
    </MemoryRouter>,
  );
}

describe("FriendSummaryView component", () => {
  beforeEach(() => {
    onRemove.mockReset();
  });

  it("displays the friend's display name", () => {
    renderComponent();
    expect(screen.getByText("Sénior Dos")).not.toBeNull();
  });

  it("calls onRemove with the friend's info when Remove is clicked", () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(friend);
  });
});
