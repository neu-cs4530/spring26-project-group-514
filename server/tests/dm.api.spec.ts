import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";
import { DirectChatRepo, UserRepo, MessageRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

let response: Response;

describe("GET /api/dm/list/:username", () => {
  it("should 401 for nonexistent user", async () => {
    response = await supertest(app).get("/api/dm/list/nonexistent").set("x-password", "bruh");
    expect(response.status).toBe(401);
  });

  it("should 401 for bad credentials", async () => {
    response = await supertest(app).get("/api/dm/list/user0").set("x-password", "wrong");
    expect(response.status).toBe(401);
  });

  it("should 400 when password header is missing", async () => {
    response = await supertest(app).get("/api/dm/list/user0");
    expect(response.status).toBe(400);
  });

  it("should return empty array for user with no DMs", async () => {
    response = await supertest(app).get("/api/dm/list/user2").set("x-password", "pwd2222");
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should return DM conversations for a user", async () => {
    // Manually seed a DM between user0 and user1
    const user0 = (await getUserByUsername("user0"))!;
    const user1 = (await getUserByUsername("user1"))!;

    const msgId = await MessageRepo.add({
      text: "hey!",
      createdBy: user0.userId,
      createdAt: new Date().toISOString(),
    });

    const chatId = await DirectChatRepo.add({
      participants: [user0.userId, user1.userId],
      messages: [msgId],
      createdAt: new Date().toISOString(),
    });

    // Update both users' directChats
    const user0Rec = await UserRepo.get(user0.userId);
    const user1Rec = await UserRepo.get(user1.userId);
    user0Rec.directChats[user1.userId] = chatId;
    user1Rec.directChats[user0.userId] = chatId;
    await UserRepo.set(user0.userId, user0Rec);
    await UserRepo.set(user1.userId, user1Rec);

    // Both users should see the DM
    response = await supertest(app).get("/api/dm/list/user0").set("x-password", "pwd0000");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toStrictEqual(
      expect.objectContaining({
        directChatId: chatId,
        participants: ["user0", "user1"],
        createdAt: expect.anything(),
      }),
    );
    expect(response.body[0]).not.toHaveProperty("messages");

    response = await supertest(app).get("/api/dm/list/user1").set("x-password", "pwd1111");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toStrictEqual(
      expect.objectContaining({
        directChatId: chatId,
        participants: ["user0", "user1"],
        createdAt: expect.anything(),
      }),
    );
    expect(response.body[0]).not.toHaveProperty("messages");
  });
});

describe("GET /api/dm/:id", () => {
  it("should 400 when auth headers are missing", async () => {
    response = await supertest(app).get("/api/dm/some-id");
    expect(response.status).toBe(400);
  });

  it("should 401 for bad credentials", async () => {
    response = await supertest(app)
      .get("/api/dm/some-id")
      .set("x-username", "user0")
      .set("x-password", "wrong");
    expect(response.status).toBe(401);
  });

  it("should 404 for nonexistent DM", async () => {
    response = await supertest(app)
      .get("/api/dm/nonexistent-id")
      .set("x-username", "user0")
      .set("x-password", "pwd0000");
    expect(response.status).toBe(404);
  });

  it("should 403 when user is not a participant", async () => {
    const user0 = (await getUserByUsername("user0"))!;
    const user1 = (await getUserByUsername("user1"))!;

    const chatId = await DirectChatRepo.add({
      participants: [user0.userId, user1.userId],
      messages: [],
      createdAt: new Date().toISOString(),
    });

    // user2 is not a participant
    response = await supertest(app)
      .get(`/api/dm/${chatId}`)
      .set("x-username", "user2")
      .set("x-password", "pwd2222");
    expect(response.status).toBe(403);
  });

  it("should return full DM with messages for a participant", async () => {
    const user0 = (await getUserByUsername("user0"))!;
    const user1 = (await getUserByUsername("user1"))!;

    const msgId = await MessageRepo.add({
      text: "hello!",
      createdBy: user0.userId,
      createdAt: new Date().toISOString(),
    });

    const chatId = await DirectChatRepo.add({
      participants: [user0.userId, user1.userId],
      messages: [msgId],
      createdAt: new Date().toISOString(),
    });

    response = await supertest(app)
      .get(`/api/dm/${chatId}`)
      .set("x-username", "user0")
      .set("x-password", "pwd0000");
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(
      expect.objectContaining({
        id: chatId,
        participants: ["user0", "user1"],
        createdAt: expect.anything(),
      }),
    );
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0]).toStrictEqual(
      expect.objectContaining({
        messageId: msgId,
        text: "hello!",
        createdBy: {
          username: user0.username,
          display: expect.anything(),
          createdAt: expect.anything(),
        },
        createdAt: expect.anything(),
      }),
    );
  });
});
