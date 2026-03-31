import { type DirectChatInfo, type DirectChatSummary } from "@gamenite/shared";
import { DirectChatRepo, UserRepo } from "../repository.ts";
import { getUserByUsername } from "./auth.service.ts";
import { getMessagesById } from "./message.service.ts";

/**
 * Populates a DirectChatRecord into a DirectChatInfo for the client.
 */
async function populateDirectChatInfo(
  id: string,
  record: { participants: [string, string]; messages: string[]; createdAt: string },
): Promise<DirectChatInfo> {
  const [user1, user2] = await Promise.all([
    UserRepo.get(record.participants[0]),
    UserRepo.get(record.participants[1]),
  ]);

  return {
    id,
    participants: [user1.username, user2.username],
    messages: await getMessagesById(record.messages),
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Populates a DirectChatRecord into a DirectChatSummary for the client.
 *
 * @param id
 * @param record
 * @returns
 */
async function populateDirectChatSummary(
  id: string,
  record: { participants: [string, string]; messages: string[]; createdAt: string },
): Promise<DirectChatSummary> {
  const [user1, user2] = await Promise.all([
    UserRepo.get(record.participants[0]),
    UserRepo.get(record.participants[1]),
  ]);

  return {
    directChatId: id,
    participants: [user1.username, user2.username],
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Retrieves all DM conversations for a user.
 *
 * @param username - The username to look up DMs for
 * @returns all DirectChatSummary objects where the user is a participant
 * @throws if the username does not exist
 */
export async function getDmList(username: string): Promise<DirectChatSummary[]> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const userRecord = await UserRepo.get(user.userId);
  const chatIds = Object.values(userRecord.directChats);

  if (chatIds.length === 0) return [];

  const records = await DirectChatRepo.getMany(chatIds);

  return Promise.all(records.map((record, i) => populateDirectChatSummary(chatIds[i], record)));
}

/**
 * Retrieves a DM conversation by its ID.
 *
 * @param id - The DirectChatRecord ID
 * @returns The populated DirectChatInfo
 * @throws If the ID does not exist
 */
export async function getDmById(id: string): Promise<DirectChatInfo> {
  const record = await DirectChatRepo.get(id);
  return populateDirectChatInfo(id, record);
}

/**
 * Adds a message to a DM conversation.
 *
 * @param dmId - The DM conversation ID
 * @param messageId - The message ID to append
 * @throws If the DM ID does not exist
 */
export async function addMessageToDm(dmId: string, messageId: string): Promise<void> {
  const record = await DirectChatRepo.get(dmId);
  await DirectChatRepo.set(dmId, {
    ...record,
    messages: [...record.messages, messageId],
  });
}

export async function createDm(userId1: string, userId2: string): Promise<string> {
  const dmId = await DirectChatRepo.add({
    participants: [userId1, userId2],
    messages: [],
    createdAt: new Date().toISOString(),
  });

  const [user1Rec, user2Rec] = await Promise.all([UserRepo.get(userId1), UserRepo.get(userId2)]);

  user1Rec.directChats[userId2] = dmId;
  user2Rec.directChats[userId1] = dmId;

  await Promise.all([UserRepo.set(userId1, user1Rec), UserRepo.set(userId2, user2Rec)]);

  return dmId;
}

export async function deleteDm(userId1: string, userId2: string): Promise<void> {
  const [user1Rec, user2Rec] = await Promise.all([UserRepo.get(userId1), UserRepo.get(userId2)]);

  const dmId = user1Rec.directChats[userId2];

  delete user1Rec.directChats[userId2];
  delete user2Rec.directChats[userId1];

  await Promise.all([
    UserRepo.set(userId1, user1Rec),
    UserRepo.set(userId2, user2Rec),
    DirectChatRepo.delete(dmId),
  ]);
}
