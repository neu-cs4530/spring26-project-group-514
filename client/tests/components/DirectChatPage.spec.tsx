import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DirectChatPage from "../../src/pages/DirectChatPage.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { MessageInfo, SafeUserInfo } from "@gamenite/shared";

const mockedUseSocketsForDM = vi.hoisted(() => vi.fn());
vi.mock("../../src/hooks/useSocketsForDM.ts", () => ({ default: mockedUseSocketsForDM }));
vi.mock("../../src/hooks/useTimeSince.ts", () => ({ default: () => () => "just now" }));

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useParams: () => ({ chatId: "dm-1" }) };
});

const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as GameSocket;
const currentUser: SafeUserInfo = {
  username: "user1",
  display: "User One",
  createdAt: new Date("2025-01-01"),
};
const handleMessageCreation = vi.fn();

const mockMessage: MessageInfo = {
  messageId: "msg-1",
  text: "Hey there!",
  createdAt: new Date("2025-01-01"),
  createdBy: { username: "user2", display: "Sénior Dos", createdAt: new Date("2025-01-01") },
};

function renderPage() {
  render(
    <MemoryRouter>
      <LoginContext
        value={{ user: currentUser, pass: "pwd1111", socket: mockSocket, reset: vi.fn() }}
      >
        <DirectChatPage />
      </LoginContext>
    </MemoryRouter>,
  );
}

describe("DirectChatPage", () => {
  beforeEach(() => {
    handleMessageCreation.mockReset();
    mockedUseSocketsForDM.mockReturnValue({ messages: null, handleMessageCreation });
  });

  it("shows 'Loading...' while the conversation is being fetched", () => {
    renderPage();
    expect(screen.getByText("Loading...")).not.toBeNull();
  });

  it("renders the message list and input when messages are loaded", () => {
    mockedUseSocketsForDM.mockReturnValue({ messages: [mockMessage], handleMessageCreation });
    renderPage();
    expect(screen.getByText("Hey there!")).not.toBeNull();
    expect(screen.getByRole("textbox")).not.toBeNull();
  });

  it("does not show the message input while still loading", () => {
    renderPage();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
