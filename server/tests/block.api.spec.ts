// server/tests/block.api.spec.ts
import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";

let response: Response;
const auth0 = { username: "user0", password: "pwd0000" };
const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };

/** Helper: make user0 and user1 friends */
async function makeFriends(a1 = auth0, a2 = auth1) {
  const sendRes = await supertest(app)
    .post("/api/friend/request")
    .send({ auth: a1, payload: { toUsername: a2.username } });
  await supertest(app)
    .post("/api/friend/respond")
    .send({ auth: a2, payload: { requestId: sendRes.body.id, action: "accepted" } });
}

describe("POST /api/block/block", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/block/block").send({ bad: "data" });
    expect(response.status).toBe(400);
  });

  it("should return 403 for invalid credentials", async () => {
    response = await supertest(app)
      .post("/api/block/block")
      .send({
        auth: { username: "user0", password: "wrong" },
        payload: { blockedUsername: "user1" },
      });
    expect(response.status).toBe(403);
  });

  it("should return 400 when blocking self", async () => {
    response = await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user0" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 for nonexistent target user", async () => {
    response = await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "nonexistent" } });
    expect(response.status).toBe(400);
  });

  it("should block a user successfully", async () => {
    response = await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user1" } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expect.objectContaining({ username: "user1" }));
  });

  it("should return 400 when blocking an already blocked user", async () => {
    await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user1" } });

    response = await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user1" } });
    expect(response.status).toBe(400);
  });

  it("should remove friendship when blocking a friend", async () => {
    await makeFriends(auth0, auth2);

    // Verify they are friends
    let friendsRes = await supertest(app).get("/api/friend/list/user0");
    let friends: { username: string }[] = friendsRes.body;
    let friendNames = friends.map((f) => f.username);
    expect(friendNames).toContain("user2");

    // Block
    response = await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user2" } });
    expect(response.status).toBe(200);

    // Verify no longer friends (both directions)
    friendsRes = await supertest(app).get("/api/friend/list/user0");
    friends = friendsRes.body;
    friendNames = friends.map((f) => f.username);
    expect(friendNames).not.toContain("user2");

    friendsRes = await supertest(app).get("/api/friend/list/user2");
    friends = friendsRes.body;
    friendNames = friends.map((f) => f.username);
    expect(friendNames).not.toContain("user0");
  });

  it("should delete DM when blocking a friend", async () => {
    await makeFriends(auth0, auth1);

    // Verify DM exists
    let dmRes = await supertest(app).get("/api/dm/list/user0").set("x-password", auth0.password);
    let dmParticipants = (dmRes.body as { participants: string[] }[]).map((d) => d.participants);
    expect(dmParticipants).toContainEqual(expect.arrayContaining(["user0", "user1"]));
    const dmId = dmRes.body[0].directChatId;

    // Block
    await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user1" } });

    // Verify DM is gone for both
    dmRes = await supertest(app).get("/api/dm/list/user0").set("x-password", auth0.password);
    dmParticipants = (dmRes.body as { participants: string[] }[]).map((d) => d.participants);
    expect(dmParticipants).not.toContainEqual(expect.arrayContaining(["user0", "user1"]));

    dmRes = await supertest(app).get("/api/dm/list/user1").set("x-password", auth1.password);
    dmParticipants = (dmRes.body as { participants: string[] }[]).map((d) => d.participants);
    expect(dmParticipants).not.toContainEqual(expect.arrayContaining(["user0", "user1"]));

    // Verify DM is not accessible by ID
    const dmById = await supertest(app)
      .get(`/api/dm/${dmId}`)
      .set("x-username", auth0.username)
      .set("x-password", auth0.password);
    expect(dmById.status).toBe(404);
  });

  it("should cancel pending outgoing friend request when blocking", async () => {
    // user0 sends request to user2
    await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth0, payload: { toUsername: "user2" } });

    // Block user2
    await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user2" } });

    // Verify no pending requests for either user
    let reqsRes = await supertest(app).get("/api/friend/requests/user0");
    expect(reqsRes.body).toStrictEqual([]);

    reqsRes = await supertest(app).get("/api/friend/requests/user2");
    expect(reqsRes.body).toStrictEqual([]);
  });

  it("should cancel pending incoming friend request when blocking", async () => {
    // user2 sends request to user0
    await supertest(app)
      .post("/api/friend/request")
      .send({ auth: auth2, payload: { toUsername: "user0" } });

    // user0 blocks user2
    await supertest(app)
      .post("/api/block/block")
      .send({ auth: auth0, payload: { blockedUsername: "user2" } });

    // Verify no pending requests for either user
    let reqsRes = await supertest(app).get("/api/friend/requests/user0");
    expect(reqsRes.body).toStrictEqual([]);

    reqsRes = await supertest(app).get("/api/friend/requests/user2");
    expect(reqsRes.body).toStrictEqual([]);
  });
});
