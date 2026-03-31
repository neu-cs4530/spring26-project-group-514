import { type SafeUserInfo } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { FriendRequestRepo, UserRepo } from "../repository.ts";
import { deleteDm } from "./dm.service.ts";

/**
 * Blocks a user. Cascades: removes friendship, cancels pending friend
 * requests in both directions, and deletes any DM between the two users.
 *
 * @param blockerUsername - the user performing the block
 * @param blockedUsername - the user being blocked
 * @returns SafeUserInfo of the blocked user
 */
export async function blockUser(
  blockerUsername: string,
  blockedUsername: string,
): Promise<SafeUserInfo> {
  if (blockerUsername === blockedUsername) throw new Error("Cannot block yourself");

  const blocker = await getUserByUsername(blockerUsername);
  const blocked = await getUserByUsername(blockedUsername);

  if (!blocker) throw new Error(`No user ${blockerUsername}`);
  if (!blocked) throw new Error(`No user ${blockedUsername}`);

  const blockerRec = await UserRepo.get(blocker.userId);
  const blockedRec = await UserRepo.get(blocked.userId);

  if (blocked.userId in blockerRec.blocked) throw new Error("User already blocked");

  // Add to block list
  blockerRec.blocked[blocked.userId] = true;

  // Cascade: remove friendship if exists
  if (blocked.userId in blockerRec.friends) {
    delete blockerRec.friends[blocked.userId];
    delete blockedRec.friends[blocker.userId];
  }

  // Cascade: cancel pending friend requests in both directions
  if (blocked.userId in blockerRec.friendOutReqs) {
    const reqId = blockerRec.friendOutReqs[blocked.userId];
    const req = await FriendRequestRepo.get(reqId);
    req.status = "rejected";
    req.respondedAt = new Date().toISOString();
    await FriendRequestRepo.set(reqId, req);
    delete blockerRec.friendOutReqs[blocked.userId];
    delete blockedRec.friendInReqs[blocker.userId];
  }

  if (blocked.userId in blockerRec.friendInReqs) {
    const reqId = blockerRec.friendInReqs[blocked.userId];
    const req = await FriendRequestRepo.get(reqId);
    req.status = "rejected";
    req.respondedAt = new Date().toISOString();
    await FriendRequestRepo.set(reqId, req);
    delete blockerRec.friendInReqs[blocked.userId];
    delete blockedRec.friendOutReqs[blocker.userId];
  }

  // Save both user records
  await Promise.all([
    UserRepo.set(blocker.userId, blockerRec),
    UserRepo.set(blocked.userId, blockedRec),
  ]);

  // Cascade: delete DM if exists
  if (blocked.userId in blockerRec.directChats) {
    await deleteDm(blocker.userId, blocked.userId);
  }

  return populateSafeUserInfo(blocked.userId);
}
