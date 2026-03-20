import { type SafeUserInfo } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { UserRepo } from "../repository.ts";

/**
 * Retrieves a friend list of a user
 *
 * @param username user to get friend list from
 * @returns the friend list of the user
 */
export async function getFriendsList(username: string): Promise<SafeUserInfo[]> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const userRecord = await UserRepo.get(user.userId);

  return Promise.all(userRecord.friends.map(populateSafeUserInfo));
}

/**
 * Add new friend to the friend list of the two users
 *
 * @param username1 user to be added to friend list of user2
 * @param username2 user to be added to friend list of user1
 * @returns void since just updating the friend list
 *
 */
export async function addFriend(username1: string, username2: string): Promise<void> {
  const user1 = await getUserByUsername(username1);
  const user2 = await getUserByUsername(username2);

  if (!user1) throw new Error(`No user ${username1}`);
  if (!user2) throw new Error(`No user ${username2}`);

  const userRecord1 = await UserRepo.get(user1.userId);
  const userRecord2 = await UserRepo.get(user2.userId);

  userRecord1.friends.push(user2.userId);
  userRecord2.friends.push(user1.userId);
  await UserRepo.set(user1.userId, userRecord1);
  await UserRepo.set(user2.userId, userRecord2);
}
