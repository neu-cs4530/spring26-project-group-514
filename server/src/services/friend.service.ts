import { type SafeUserInfo } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { FriendRequestRepo } from "../repository.ts";

export async function getFriendsList(username: string): Promise<SafeUserInfo[]> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const keys = await FriendRequestRepo.getAllKeys();
  const records = await FriendRequestRepo.getMany(keys);

  const friendUserIds = records
    .filter(
      (r) => r.status === "accepted" && (r.fromUser === user.userId || r.toUser === user.userId),
    )
    .map((r) => (r.fromUser === user.userId ? r.toUser : r.fromUser));

  return Promise.all(friendUserIds.map(populateSafeUserInfo));
}
