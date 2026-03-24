import type { ErrorMsg, FriendRequest, FriendSummary } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { getFriendList, respondToRequest } from "../services/friendService.ts";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";

/**
 * Custom hook to get the current user's accepted friends list.
 * Also subscribes to `friendRequestUpdated` socket events so the list
 * updates in real time when a friendship is accepted or removed.
 *
 * @returns A message to display to the user (Loading... or an error), or a list of FriendSummary
 *          plus a `removeFriend` callback
 */
export default function useFriendList(): {
  friends: { message: string } | FriendSummary[];
  removeFriend: (targetUsername: string) => void;
} {
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const [friends, setFriends] = useState<FriendSummary[] | ErrorMsg | null>(null);

  useEffect(() => {
    getFriendList(user.username).then(setFriends);
  }, [user.username]);

  useEffect(() => {
    const handleFriendRequestUpdated = (updated: FriendRequest) => {
      if (updated.status === "rejected") {
        setFriends((prev) =>
          Array.isArray(prev)
            ? prev.filter((f) => f.username !== updated.fromUser && f.username !== updated.toUser)
            : prev,
        );
      }
      if (updated.status === "accepted") {
        const newFriend: FriendSummary = {
          username: updated.fromUser === user.username ? updated.toUser : updated.fromUser,
          friendsSince: updated.respondedAt ?? updated.createdAt,
        };
        setFriends((prev) => (Array.isArray(prev) ? [...prev, newFriend] : [newFriend]));
      }
    };

    socket.on("friendRequestUpdated", handleFriendRequestUpdated);
    return () => {
      socket.off("friendRequestUpdated", handleFriendRequestUpdated);
    };
  }, [socket, user.username]);

  const removeFriend = (targetUsername: string) => {
    // TODO: confirm with teammate whether /respond with "rejected" is the
    // intended remove mechanism, or if a dedicated endpoint will be added.
    setFriends((prev) =>
      Array.isArray(prev) ? prev.filter((f) => f.username !== targetUsername) : prev,
    );
  };

  if (!friends) return { friends: { message: "Loading..." }, removeFriend };
  if ("error" in friends) return { friends: { message: `Error: ${friends.error}` }, removeFriend };
  if (friends.length === 0) return { friends: { message: "No friends yet..." }, removeFriend };
  return { friends, removeFriend };
}
