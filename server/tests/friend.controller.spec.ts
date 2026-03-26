import type { FriendRequest } from "@gamenite/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, RestAPI } from "../src/types.ts";
import { postRequest, postRespond } from "../src/controllers/friend.controller.ts";

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const mockIo = new MockGameServer() as unknown as GameServer;

const auth0 = { username: "user0", password: "pwd0000" };
const auth1 = { username: "user1", password: "pwd1111" };

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

describe("postRespond socket emission", () => {
  it("should emit friendRequestUpdated to sender on accept", async () => {
    // First create a request so we have a requestId
    const createReqRes = mockReqRes({
      auth: auth0,
      payload: { toUsername: "user1" },
    });
    await postRequest(mockIo)(createReqRes.req, createReqRes.res);
    const friendReq = (createReqRes.res.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    vi.resetAllMocks();

    const { req, res } = mockReqRes({
      auth: auth1,
      payload: { requestId: friendReq.id, action: "accepted" },
    });

    await postRespond(mockIo)(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ fromUser: "user0", toUser: "user1", status: "accepted" }),
    );
    expect(mockIo.to).toHaveBeenCalledExactlyOnceWith("user:user0");
    expect(mockIo.emit).toHaveBeenCalledExactlyOnceWith(
      "friendRequestUpdated",
      expect.objectContaining({ fromUser: "user0", toUser: "user1", status: "accepted" }),
    );
  });

  it("should emit friendRequestUpdated to sender on reject", async () => {
    const createReqRes = mockReqRes({
      auth: auth0,
      payload: { toUsername: "user1" },
    });
    await postRequest(mockIo)(createReqRes.req, createReqRes.res);
    const friendReq = (createReqRes.res.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    vi.resetAllMocks();

    const { req, res } = mockReqRes({
      auth: auth1,
      payload: { requestId: friendReq.id, action: "rejected" },
    });

    await postRespond(mockIo)(req, res);

    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
    expect(mockIo.to).toHaveBeenCalledExactlyOnceWith("user:user0");
    expect(mockIo.emit).toHaveBeenCalledExactlyOnceWith(
      "friendRequestUpdated",
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("should not emit when respond fails", async () => {
    const { req, res } = mockReqRes({
      auth: auth1,
      payload: { requestId: "nonexistent", action: "accepted" },
    });

    await postRespond(mockIo)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
