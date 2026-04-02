import type { SafeUserInfo } from "./user.types.ts";

/**
 * Represents a friend request exposed to the client
 * - `id`: the id to reference to this friend request.
 * - `fromUser`: the SafeUserInfo of the user that sent the request.
 * - `toUser`: the SafeUserInfo of the user that received the request.
 * - `status`: the status of the request.
 * - `createdAt`: the time the request was sent.
 * - `respondedAt`: the time the request was responded to.
 */
export interface FriendRequest {
  id: string;
  fromUser: SafeUserInfo; // User's username
  toUser: SafeUserInfo; // User's username
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  respondedAt?: Date;
}
