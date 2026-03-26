import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { socketDmJoin } from "../src/controllers/dm.controller.ts";
import { DirectChatRepo, UserRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

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
    to = vi.fn(() => this);
  },
);

const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
const auth0 = { username: "user0", password: "pwd0000" };
const badAuth = { username: "user0", password: "nope" };

afterEach(() => {
  vi.resetAllMocks();
});

/** Helper: seed a DM between user0 and user1, return the chatId */
async function seedDm(): Promise<string> {
  const user0 = (await getUserByUsername("user0"))!;
  const user1 = (await getUserByUsername("user1"))!;
  const chatId = await DirectChatRepo.add({
    participants: [user0.userId, user1.userId],
    messages: [],
    createdAt: new Date().toISOString(),
  });
  const user0Rec = await UserRepo.get(user0.userId);
  const user1Rec = await UserRepo.get(user1.userId);
  user0Rec.directChats[user1.userId] = chatId;
  user1Rec.directChats[user0.userId] = chatId;
  await UserRepo.set(user0.userId, user0Rec);
  await UserRepo.set(user1.userId, user1Rec);
  return chatId;
}

describe("socketDmJoin", () => {
  it("should reject invalid auth", async () => {
    const chatId = await seedDm();
    await socketDmJoin(mockSocket, mockServer)({ auth: badAuth, payload: chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject a non-participant", async () => {
    const chatId = await seedDm();
    const auth2 = { username: "user2", password: "pwd2222" };
    await socketDmJoin(mockSocket, mockServer)({ auth: auth2, payload: chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error(`user user2 is not a participant of DM ${chatId}`),
    );
  });

  it("should reject a nonexistent DM id", async () => {
    await socketDmJoin(mockSocket, mockServer)({ auth: auth0, payload: "nonexistent" });
    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("should join the room and emit dmJoined for a valid participant", async () => {
    const chatId = await seedDm();
    await socketDmJoin(mockSocket, mockServer)({ auth: auth0, payload: chatId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith(chatId);
    expect(mockSocket.emit).toHaveBeenCalledExactlyOnceWith(
      "dmJoined",
      expect.objectContaining({
        id: chatId,
        participants: ["user0", "user1"],
        messages: [],
      }),
    );
  });
});
