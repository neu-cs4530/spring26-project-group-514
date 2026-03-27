import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { socketRegisterUser } from "../src/controllers/user.controller.ts";

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const MockGameServerSocket = vi.fn(
  class {
    id = "mockGameServerSocket";
    join = vi.fn();
    emit = vi.fn();
  },
);

const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
const auth = { username: "user1", password: "pwd1111" };
const badAuth = { username: "user1", password: "wrong" };

afterEach(() => {
  vi.resetAllMocks();
});

describe("socketRegisterUser", () => {
  it("should not join a room for a malformed payload", async () => {
    await socketRegisterUser(mockSocket, mockServer)("garbage");
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should not join a room for invalid credentials", async () => {
    await socketRegisterUser(mockSocket, mockServer)({ auth: badAuth, payload: null });
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should join the socket to the user's personal room on valid auth", async () => {
    await socketRegisterUser(mockSocket, mockServer)({ auth, payload: null });
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith("user:user1");
  });
});
