/**
 * Represents a friend request exposed to the client
 * - `id`: the id to reference to this friend request.
 * - `fromUser`: the username of the user that sent the request.
 * - `toUser`: the username of the user that received the request.
 * - `status`: the status of the request.
 * - `createdAt`: the time the request was sent.
 * - `respondedAt`: the time the request was responded to.
 */
export interface FriendRequest {
  id: string;
  fromUser: string; // User's username
  toUser: string; // User's username
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  respondedAt?: Date;
}
