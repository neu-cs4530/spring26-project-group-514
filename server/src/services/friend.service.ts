import { type SafeUserInfo, type FriendRequest } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { FriendRequestRepo, UserRepo } from "../repository.ts";
import type { FriendRequestRecord } from "../models.ts";

/**
 * Parse user's friend request information to be served to the client
 *
 * @param id the id of the record
 * @param record the friend request record to parse
 * @return friend request record to be served to the client
 */
export async function populateFriendRequest(
  id: string,
  record: FriendRequestRecord,
): Promise<FriendRequest> {
  const [fromUser, toUser] = await Promise.all([
    UserRepo.get(record.fromUser),
    UserRepo.get(record.toUser),
  ]);
  return {
    id,
    fromUser: fromUser.username,
    toUser: toUser.username,
    status: record.status,
    createdAt: new Date(record.createdAt),
    ...(record.respondedAt && { respondedAt: new Date(record.respondedAt) }),
  };
}

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
 * Retrieves all pending requests from a user (both the request the get and receives)
 *
 * @param username user to get pending requests from
 * @returns a list of pending requests
 */
export async function getPendingRequests(username: string): Promise<FriendRequest[]> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const userRecord = await UserRepo.get(user.userId);
  const requestIds = [...userRecord.friendInReqs, ...userRecord.friendOutReqs];
  const records = await FriendRequestRepo.getMany(requestIds);

  return Promise.all(records.map((record, i) => populateFriendRequest(requestIds[i], record)));
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

/**
 * Handles sending friend request from a user to another user
 *
 * @param fromUsername username of user that sent the friend request
 * @param toUsername username of user that receives the friend request
 * @returns the created friend request
 *
 */
export async function sendFriendRequest(
  fromUsername: string,
  toUsername: string,
): Promise<FriendRequest> {
  if (fromUsername === toUsername) throw new Error(`Can't send friend request to self`);

  const fromUser = await getUserByUsername(fromUsername);
  const toUser = await getUserByUsername(toUsername);

  if (!fromUser) throw new Error(`No user ${fromUsername}`);
  if (!toUser) throw new Error(`No user ${toUsername}`);

  if (fromUser.username === toUser.username) throw new Error(`Can't send friend request to self`);

  const id = await FriendRequestRepo.add({
    fromUser: fromUser.userId,
    toUser: toUser.userId,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  const fromUserRec = await UserRepo.get(fromUser.userId);
  const toUserRec = await UserRepo.get(toUser.userId);

  fromUserRec.friendOutReqs.push(id);
  toUserRec.friendInReqs.push(id);
  await UserRepo.set(fromUser.userId, fromUserRec);
  await UserRepo.set(toUser.userId, toUserRec);

  return Promise.resolve(populateFriendRequest(id, await FriendRequestRepo.get(id)));
}
