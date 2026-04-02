import type { ErrorMsg, FriendRequest, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import {
  getPendingRequests,
  respondToRequest,
  sendFriendRequest,
} from "../services/friendService.ts";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";

/**
 * Custom hook to manage pending incoming and outgoing friend requests.
 * Subscribes to `friendRequestReceived` so new requests appear in real time
 * without a page refresh (CoS 1.5).
 *
 * @returns incoming and outgoing request lists, plus action callbacks
 */
export default function useFriendRequests(): {
  incoming: { message: string } | FriendRequest[];
  outgoing: { message: string } | FriendRequest[];
  sendRequest: (toUsername: string) => Promise<string | null>;
  acceptRequest: (requestId: string) => Promise<string | null>;
  declineRequest: (requestId: string) => Promise<string | null>;
} {
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const [requests, setRequests] = useState<FriendRequest[] | ErrorMsg | null>(null);

  useEffect(() => {
    getPendingRequests(user.username).then(setRequests);
  }, [user.username]);

  useEffect(() => {
    const handleFriendRequestReceived = (req: FriendRequest) => {
      setRequests((prev) => (Array.isArray(prev) ? [req, ...prev] : [req]));
    };

    socket.on("friendRequestReceived", handleFriendRequestReceived);
    return () => {
      socket.off("friendRequestReceived", handleFriendRequestReceived);
    };
  }, [socket]);

  useEffect(() => {
    const handleUserBlocked = (blocker: SafeUserInfo) => {
      setRequests((prev) =>
        Array.isArray(prev)
          ? prev.filter(
              (r) =>
                r.fromUser.username !== blocker.username && r.toUser.username !== blocker.username,
            )
          : prev,
      );
    };

    socket.on("userBlocked", handleUserBlocked);
    return () => {
      socket.off("userBlocked", handleUserBlocked);
    };
  }, [socket]);

  const removeById = (id: string) =>
    setRequests((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));

  useEffect(() => {
    const handleFriendRequestUpdated = (updated: FriendRequest) => {
      if (updated.status !== "pending") {
        removeById(updated.id);
      }
    };

    socket.on("friendRequestUpdated", handleFriendRequestUpdated);
    return () => {
      socket.off("friendRequestUpdated", handleFriendRequestUpdated);
    };
  }, [socket]);

  // sendRequest: return error or null on success
  const sendRequest = async (toUsername: string): Promise<string | null> => {
    const result = await sendFriendRequest(auth, toUsername);
    if (result && !("error" in result)) {
      setRequests((prev) => (Array.isArray(prev) ? [...prev, result] : [result]));
      return null;
    }
    return result?.error ?? "Unknown Error";
  };

  // acceptRequest: return error or null on success
  const acceptRequest = async (requestId: string): Promise<string | null> => {
    const result = await respondToRequest(auth, requestId, "accepted");
    if (result && !("error" in result)) {
      removeById(requestId);
      return null;
    }
    return result?.error ?? "Unknown Error";
  };

  // declineRequest: return error or null on success
  const declineRequest = async (requestId: string): Promise<string | null> => {
    const result = await respondToRequest(auth, requestId, "rejected");
    if (result && !("error" in result)) {
      removeById(requestId);
      return null;
    }
    return result?.error ?? "Unknown Error";
  };

  const allRequests = Array.isArray(requests) ? requests : [];

  const incomingArr = allRequests.filter(
    (r) => r.toUser.username === user.username && r.status === "pending",
  );
  const outgoingArr = allRequests.filter(
    (r) => r.fromUser.username === user.username && r.status === "pending",
  );

  const incoming: { message: string } | FriendRequest[] = !requests
    ? { message: "Loading..." }
    : "error" in requests
      ? { message: `Error: ${requests.error}` }
      : incomingArr.length === 0
        ? { message: "No incoming requests." }
        : incomingArr;

  const outgoing: { message: string } | FriendRequest[] = !requests
    ? { message: "Loading..." }
    : "error" in requests
      ? { message: `Error: ${requests.error}` }
      : outgoingArr.length === 0
        ? { message: "No outgoing requests." }
        : outgoingArr;

  return { incoming, outgoing, sendRequest, acceptRequest, declineRequest };
}
