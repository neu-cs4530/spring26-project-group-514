import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";
import { DirectChatRepo, UserRepo, MessageRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

let response: Response;

describe("GET /api/dm/list/:username", () => {
  it("should 404 for nonexistent user", async () => {
    response = await supertest(app).get("/api/dm/list/nonexistent");
    expect(response.status).toBe(404);
  });

  it("should return empty array for user with no DMs", async () => {
    response = await supertest(app).get("/api/dm/list/user2");
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
    response = await supertest(app).get("/api/dm/list/user0");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toStrictEqual(
      expect.objectContaining({
        id: chatId,
        participants: ["user0", "user1"],
      }),
    );
    expect(response.body[0].messages).toHaveLength(1);
    expect(response.body[0].messages[0]).toStrictEqual(
      expect.objectContaining({
        messageId: msgId,
        text: "hey!",
        createdBy: {
          username: user0.username,
          display: "The Knight Of Games",
          createdAt: expect.anything(),
        },
      }),
    );

    response = await supertest(app).get("/api/dm/list/user1");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toStrictEqual(
      expect.objectContaining({
        id: chatId,
        participants: ["user0", "user1"],
      }),
    );
    expect(response.body[0].messages).toHaveLength(1);
    expect(response.body[0].messages[0]).toStrictEqual(
      expect.objectContaining({
        messageId: msgId,
        text: "hey!",
        createdBy: {
          username: user0.username,
          display: "The Knight Of Games",
          createdAt: expect.anything(),
        },
      }),
    );
  });
});
