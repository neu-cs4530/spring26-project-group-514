import { type DirectChatInfo } from "@gamenite/shared";
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
 * Retrieves all DM conversations for a user.
 *
 * @param username - The username to look up DMs for
 * @returns all DirectChatInfo objects where the user is a participant
 * @throws if the username does not exist
 */
export async function getDmList(username: string): Promise<DirectChatInfo[]> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const userRecord = await UserRepo.get(user.userId);
  const chatIds = Object.values(userRecord.directChats);

  if (chatIds.length === 0) return [];

  const records = await DirectChatRepo.getMany(chatIds);

  return Promise.all(records.map((record, i) => populateDirectChatInfo(chatIds[i], record)));
}
