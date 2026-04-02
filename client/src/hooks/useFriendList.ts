import type { ErrorMsg, FriendRequest, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { getFriendList, removeFriendRequest } from "../services/friendService.ts";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";

/**
 * Custom hook to get the current user's accepted friends list.
 * Also subscribes to `friendRequestUpdated` socket events so the list
 * updates in real time when a friendship is accepted or removed.
 *
 * @returns A message to display to the user (Loading... or an error), or a list of SafeUserInfo
 *          plus a `removeFriend` callback
 */
export default function useFriendList(): {
  friends: { message: string } | SafeUserInfo[];
  removeFriend: (targetUsername: string) => Promise<void>;
} {
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const [friends, setFriends] = useState<SafeUserInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    getFriendList(user.username).then(setFriends);
  }, [user.username]);

  useEffect(() => {
    const handleFriendRequestUpdated = (updated: FriendRequest) => {
      if (updated.status === "rejected") {
        setFriends((prev) =>
          Array.isArray(prev)
            ? prev.filter(
                (f) =>
                  f.username !== updated.fromUser.username &&
                  f.username !== updated.toUser.username,
              )
            : prev,
        );
      }
      if (updated.status === "accepted") {
        getFriendList(user.username).then(setFriends);
      }
    };

    socket.on("friendRequestUpdated", handleFriendRequestUpdated);
    return () => {
      socket.off("friendRequestUpdated", handleFriendRequestUpdated);
    };
  }, [socket, user.username]);

  useEffect(() => {
    const handleFriendRemoved = (removedBy: SafeUserInfo) => {
      setFriends((prev) =>
        Array.isArray(prev) ? prev.filter((f) => f.username !== removedBy.username) : prev,
      );
    };

    socket.on("friendRemoved", handleFriendRemoved);
    return () => {
      socket.off("friendRemoved", handleFriendRemoved);
    };
  }, [socket]);

  useEffect(() => {
    const handleUserBlocked = (blocker: SafeUserInfo) => {
      setFriends((prev) =>
        Array.isArray(prev) ? prev.filter((f) => f.username !== blocker.username) : prev,
      );
    };

    socket.on("userBlocked", handleUserBlocked);
    return () => {
      socket.off("userBlocked", handleUserBlocked);
    };
  }, [socket]);

  const removeFriend = async (targetUsername: string) => {
    const result = await removeFriendRequest(auth, targetUsername);
    if (!result || "error" in result) return;
    setFriends((prev) =>
      Array.isArray(prev) ? prev.filter((f) => f.username !== targetUsername) : prev,
    );
  };

  if (!friends) return { friends: { message: "Loading..." }, removeFriend };
  if ("error" in friends) return { friends: { message: `Error: ${friends.error}` }, removeFriend };
  if (friends.length === 0) return { friends: { message: "No friends yet..." }, removeFriend };
  return { friends, removeFriend };
}
