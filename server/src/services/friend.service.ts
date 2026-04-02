import { type SafeUserInfo, type FriendRequest } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { FriendRequestRepo, UserRepo } from "../repository.ts";
import type { FriendRequestRecord } from "../models.ts";
import { createDm, deleteDm } from "./dm.service.ts";

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
    populateSafeUserInfo(record.fromUser),
    populateSafeUserInfo(record.toUser),
  ]);

  return {
    id,
    fromUser: fromUser,
    toUser: toUser,
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

  return Promise.all(Object.keys(userRecord.friends).map(populateSafeUserInfo));
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
  const requestIds = [
    ...Object.values(userRecord.friendInReqs),
    ...Object.values(userRecord.friendOutReqs),
  ];
  const records = await FriendRequestRepo.getMany(requestIds);

  return Promise.all(records.map((record, i) => populateFriendRequest(requestIds[i], record)));
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

  const fromUserRec = await UserRepo.get(fromUser.userId);
  const toUserRec = await UserRepo.get(toUser.userId);

  if (toUser.userId in fromUserRec.friends) throw new Error(`Already friends`);
  if (toUser.userId in fromUserRec.friendOutReqs || toUser.userId in fromUserRec.friendInReqs)
    throw new Error(`Friend request already pending`);

  if (toUser.userId in fromUserRec.blocked || fromUser.userId in toUserRec.blocked)
    throw new Error(`Cannot send friend request due to block`);

  const id = await FriendRequestRepo.add({
    fromUser: fromUser.userId,
    toUser: toUser.userId,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  fromUserRec.friendOutReqs[toUser.userId] = id;
  toUserRec.friendInReqs[fromUser.userId] = id;
  await UserRepo.set(fromUser.userId, fromUserRec);
  await UserRepo.set(toUser.userId, toUserRec);

  return populateFriendRequest(id, await FriendRequestRepo.get(id));
}

/**
 * Handles responding to a friend request (accept/reject)
 *
 * @param username username of the user responding to the request
 * @param requestId the id of the friend request to respond to
 * @param action whether to accept or reject the request
 * @returns the updated friend request
 */
export async function respondToFriendRequest(
  username: string,
  requestId: string,
  action: "accepted" | "rejected",
): Promise<FriendRequest> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  const record = await FriendRequestRepo.get(requestId);
  if (record.status !== "pending") throw new Error("Request already responded to");
  if (record.toUser !== user.userId) throw new Error("Only the receiver can respond");

  record.status = action;
  record.respondedAt = new Date().toISOString();

  const fromUserRec = await UserRepo.get(record.fromUser);
  const toUserRec = await UserRepo.get(record.toUser);

  delete fromUserRec.friendOutReqs[user.userId];
  delete toUserRec.friendInReqs[record.fromUser];

  if (action === "accepted") {
    fromUserRec.friends[user.userId] = true;
    toUserRec.friends[record.fromUser] = true;
  }

  await Promise.all([
    FriendRequestRepo.set(requestId, record),
    UserRepo.set(record.fromUser, fromUserRec),
    UserRepo.set(record.toUser, toUserRec),
  ]);

  if (action === "accepted") {
    await createDm(record.fromUser, user.userId);
  }

  return populateFriendRequest(requestId, record);
}

/**
 * Removes a friend from both users' friend lists
 *
 * @param username the user requesting the removal
 * @param friendUsername the friend to remove
 * @returns the removed friend's safe user info
 */
export async function removeFriend(
  username: string,
  friendUsername: string,
): Promise<SafeUserInfo> {
  if (username === friendUsername) throw new Error("Cannot remove yourself");

  const user = await getUserByUsername(username);
  const friend = await getUserByUsername(friendUsername);

  if (!user) throw new Error(`No user ${username}`);
  if (!friend) throw new Error(`No user ${friendUsername}`);

  const userRecord = await UserRepo.get(user.userId);
  const friendRecord = await UserRepo.get(friend.userId);

  if (!(friend.userId in userRecord.friends) || !(user.userId in friendRecord.friends))
    throw new Error("Not friends");

  delete userRecord.friends[friend.userId];
  delete friendRecord.friends[user.userId];

  await Promise.all([
    UserRepo.set(user.userId, userRecord),
    UserRepo.set(friend.userId, friendRecord),
  ]);

  await deleteDm(user.userId, friend.userId);

  return populateSafeUserInfo(friend.userId);
}
