import { type DirectChatInfo, type DirectChatSummary } from "@gamenite/shared";
import { DirectChatRepo, MessageRepo, UserRepo } from "../repository.ts";
import { getUserByUsername } from "./auth.service.ts";
import { getMessagesById } from "./message.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";

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
 * Binary search to count unread messages for a user in a DM.
 * Messages are stored chronologically (oldest first).
 * Returns the number of messages with createdAt > lastReadAt.
 */
async function getUnreadCount(messages: string[], lastReadAt: string): Promise<number> {
  if (messages.length === 0) return 0;

  let lo = 0;
  let hi = messages.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const msg = await MessageRepo.get(messages[mid]);
    if (msg.createdAt <= lastReadAt) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return messages.length - lo;
}

/**
 * Gets the timestamp of the last message in a DM, or null if no messages.
 */
async function getLastMessageAt(messages: string[]): Promise<Date | null> {
  if (messages.length === 0) return null;
  const msg = await MessageRepo.get(messages[messages.length - 1]);
  return new Date(msg.createdAt);
}

/**
 * Populates a DirectChatRecord into a DirectChatSummary for the client,
 * including unread count and last message timestamp.
 */
async function populateDirectChatSummary(
  id: string,
  record: {
    participants: [string, string];
    messages: string[];
    createdAt: string;
    lastReadAt?: Record<string, string>;
  },
  userId: string,
): Promise<DirectChatSummary> {
  const [user1, user2] = await Promise.all([
    populateSafeUserInfo(record.participants[0]),
    populateSafeUserInfo(record.participants[1]),
  ]);

  const lastReadAt = record.lastReadAt?.[userId] ?? record.createdAt;
  const [unreadCount, lastMessageAt] = await Promise.all([
    getUnreadCount(record.messages, lastReadAt),
    getLastMessageAt(record.messages),
  ]);

  return {
    directChatId: id,
    participants: [user1, user2],
    createdAt: new Date(record.createdAt),
    unreadCount,
    lastMessageAt,
  };
}

/**
 * Retrieves all DM conversations for a user, sorted by most recent message.
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

  const summaries = await Promise.all(
    records.map((record, i) => populateDirectChatSummary(chatIds[i], record, user.userId)),
  );

  summaries.sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return summaries;
}

/**
 * Retrieves a DM conversation by its ID.
 */
export async function getDmById(id: string): Promise<DirectChatInfo> {
  const record = await DirectChatRepo.get(id);
  return populateDirectChatInfo(id, record);
}

/**
 * Adds a message to a DM conversation.
 */
export async function addMessageToDm(dmId: string, messageId: string): Promise<void> {
  const record = await DirectChatRepo.get(dmId);
  await DirectChatRepo.set(dmId, {
    ...record,
    messages: [...record.messages, messageId],
  });
}

/**
 * Marks a DM as read for a specific user by updating their lastReadAt timestamp.
 */
export async function markDmAsRead(dmId: string, userId: string): Promise<void> {
  const record = await DirectChatRepo.get(dmId);
  await DirectChatRepo.set(dmId, {
    ...record,
    lastReadAt: { ...record.lastReadAt, [userId]: new Date().toISOString() },
  });
}

export async function createDm(userId1: string, userId2: string): Promise<string> {
  const now = new Date().toISOString();
  const dmId = await DirectChatRepo.add({
    participants: [userId1, userId2],
    messages: [],
    createdAt: now,
    lastReadAt: { [userId1]: now, [userId2]: now },
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
