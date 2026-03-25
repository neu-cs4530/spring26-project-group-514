import type { FriendRequest } from "@gamenite/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, RestAPI } from "../src/types.ts";
import { postRequest } from "../src/controllers/friend.controller.ts";

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const mockIo = new MockGameServer() as unknown as GameServer;

const auth0 = { username: "user0", password: "pwd0000" };

function mockReqRes(body: unknown) {
  const req = { body } as unknown as Parameters<RestAPI<FriendRequest>>[0];
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as Parameters<RestAPI<FriendRequest>>[1];
  return { req, res };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("postRequest socket emission", () => {
  it("should emit friendRequestReceived to target user on success", async () => {
    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { toUsername: "user1" },
    });

    await postRequest(mockIo)(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ fromUser: "user0", toUser: "user1", status: "pending" }),
    );
    expect(mockIo.to).toHaveBeenCalledExactlyOnceWith("user:user1");
    expect(mockIo.emit).toHaveBeenCalledExactlyOnceWith(
      "friendRequestReceived",
      expect.objectContaining({ fromUser: "user0", toUser: "user1", status: "pending" }),
    );
  });

  it("should not emit when request fails", async () => {
    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { toUsername: "user0" },
    });

    await postRequest(mockIo)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
