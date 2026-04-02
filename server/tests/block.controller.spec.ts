import type { SafeUserInfo } from "@gamenite/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, RestAPI } from "../src/types.ts";
import { postBlock, postUnblock } from "../src/controllers/block.controller.ts";

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const mockIo = new MockGameServer() as unknown as GameServer;

const auth0 = { username: "user0", password: "pwd0000" };

function mockReqRes(body: unknown) {
  const req = { body } as unknown as Parameters<RestAPI<SafeUserInfo>>[0];
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as Parameters<RestAPI<SafeUserInfo>>[1];
  return { req, res };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("postBlock socket emission", () => {
  it("should emit userBlocked to blocked user on success", async () => {
    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { blockedUsername: "user1" },
    });

    await postBlock(mockIo)(req, res);

    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ username: "user1" }));
    expect(mockIo.to).toHaveBeenCalledWith("user:user1");
    expect(mockIo.to).toHaveBeenCalledWith("user:user0");
    expect(mockIo.emit).toHaveBeenCalledWith(
      "userBlocked",
      expect.objectContaining({ username: "user0" }),
    );
    expect(mockIo.emit).toHaveBeenCalledWith(
      "userBlocked",
      expect.objectContaining({ username: "user1" }),
    );
  });

  it("should not emit when block fails", async () => {
    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { blockedUsername: "user0" },
    });

    await postBlock(mockIo)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});

describe("postUnblock socket emission", () => {
  it("should emit userUnblocked to unblocked user on success", async () => {
    // Block first
    const blockReqRes = mockReqRes({
      auth: auth0,
      payload: { blockedUsername: "user1" },
    });
    await postBlock(mockIo)(blockReqRes.req, blockReqRes.res);
    vi.resetAllMocks();

    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { blockedUsername: "user1" },
    });

    await postUnblock(mockIo)(req, res);

    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ username: "user1" }));
    expect(mockIo.to).toHaveBeenCalledExactlyOnceWith("user:user1");
    expect(mockIo.emit).toHaveBeenCalledExactlyOnceWith(
      "userUnblocked",
      expect.objectContaining({ username: "user0" }),
    );
  });

  it("should not emit when unblock fails", async () => {
    const { req, res } = mockReqRes({
      auth: auth0,
      payload: { blockedUsername: "user1" },
    });

    await postUnblock(mockIo)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
