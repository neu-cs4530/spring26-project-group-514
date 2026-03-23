// server/tests/friend.api.spec.ts
import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";

let response: Response;
const auth0 = { username: "user0", password: "pwd0000" };
const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const auth3 = { username: "user3", password: "pwd3333" };

describe("GET /api/friend/requests/:username", () => {
  it("should 404 for nonexistent users", async () => {
    response = await supertest(app).get("/api/friend/requests/nonexistent");
    expect(response.status).toBe(404);
  });

  it("should return empty array for user with no pending requests", async () => {
    response = await supertest(app).get("/api/friend/requests/user1");
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should return outgoing pending request for sender", async () => {
    await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });
    response = await supertest(app).get("/api/friend/requests/user0");
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      expect.objectContaining({
        fromUser: "user0",
        toUser: "user2",
        status: "pending",
      }),
    ]);
  });

  it("should return incoming pending request for receiver", async () => {
    await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });
    response = await supertest(app).get("/api/friend/requests/user2");
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      expect.objectContaining({
        fromUser: "user0",
        toUser: "user2",
        status: "pending",
      }),
    ]);
  });
});

describe("POST /api/friend/request", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/friend/request").send({ bad: "data" });
    expect(response.status).toBe(400);
  });

  it("should send a friend request successfully", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth3, payload: { toUsername: "user1" } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(
      expect.objectContaining({
        fromUser: "user3",
        toUser: "user1",
        status: "pending",
      }),
    );
  });

  it("should return 400 when sending request to self", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user0" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when already friends", async () => {
    // Create friendship: user0 sends request, user1 accepts
    const sendRes = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user1" } });
    await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth1, payload: { requestId: sendRes.body.id, action: "accepted" } });

    // Now trying to send another request should fail
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user1" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when requestor already requested", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });
    expect(response.status).toBe(200);

    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when requestor already received a request", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });
    expect(response.status).toBe(200);

    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth2, payload: { toUsername: "user0" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 for nonexistent target user", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "nonexistent" } });
    expect(response.status).toBe(400);
  });

  it("should return 403 for invalid credentials", async () => {
    response = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: { username: "user0", password: "wrong" }, payload: { toUsername: "user1" } });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/friend/respond", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/friend/respond").send({ bad: "data" });
    expect(response.status).toBe(400);
  });

  it("should return 403 for invalid credentials", async () => {
    response = await supertest(app)
      .post("/api/friend/respond")
      .send({
        auth: { username: "user2", password: "wrong" },
        payload: { requestId: "abc", action: "accepted" },
      });
    expect(response.status).toBe(403);
  });

  it("should return 400 when non-receiver tries to respond", async () => {
    const sendRes = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });

    response = await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth0, payload: { requestId: sendRes.body.id, action: "accepted" } });
    expect(response.status).toBe(400);
  });

  it("should reject a friend request successfully", async () => {
    const sendRes = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth3, payload: { toUsername: "user2" } });

    response = await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth2, payload: { requestId: sendRes.body.id, action: "rejected" } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(
      expect.objectContaining({
        fromUser: "user3",
        toUser: "user2",
        status: "rejected",
        respondedAt: expect.anything(),
      }),
    );

    let friendsRes = await supertest(app).get("/api/friend/list/user2");
    let friends: { username: string }[] = friendsRes.body;
    let friendNames = friends.map((f) => f.username);
    expect(friendNames).not.toContain("user3");

    friendsRes = await supertest(app).get("/api/friend/list/user3");
    friends = friendsRes.body;
    friendNames = friends.map((f) => f.username);
    expect(friendNames).not.toContain("user2");
  });

  it("should accept a friend request successfully", async () => {
    const sendRes = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });

    response = await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth2, payload: { requestId: sendRes.body.id, action: "accepted" } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(
      expect.objectContaining({
        fromUser: "user0",
        toUser: "user2",
        status: "accepted",
        respondedAt: expect.anything(),
      }),
    );

    // They should now be friends
    let friendsRes = await supertest(app).get("/api/friend/list/user2");
    let friends: { username: string }[] = friendsRes.body;
    let friendNames = friends.map((f) => f.username);
    expect(friendNames).toContain("user0");

    friendsRes = await supertest(app).get("/api/friend/list/user0");
    friends = friendsRes.body;
    friendNames = friends.map((f) => f.username);
    expect(friendNames).toContain("user2");
  });

  it("should return 400 when responding to already-responded request", async () => {
    const sendRes = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });

    await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth2, payload: { requestId: sendRes.body.id, action: "accepted" } });

    response = await supertest(app)
      .post("/api/friend/respond")
      .send({ auth: auth2, payload: { requestId: sendRes.body.id, action: "accepted" } });
    expect(response.status).toBe(400);
  });
});
