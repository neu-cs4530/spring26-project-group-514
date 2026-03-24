import type { ErrorMsg, FriendRequest } from "@gamenite/shared";
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
  sendRequest: (toUsername: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
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

  const removeById = (id: string) =>
    setRequests((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));

  const sendRequest = async (toUsername: string) => {
    const result = await sendFriendRequest(auth, toUsername);
    if (result && !("error" in result)) {
      setRequests((prev) => (Array.isArray(prev) ? [...prev, result] : [result]));
    }
  };

  const acceptRequest = async (requestId: string) => {
    const result = await respondToRequest(auth, requestId, "accepted");
    if (result && !("error" in result)) removeById(requestId);
  };

  const declineRequest = async (requestId: string) => {
    const result = await respondToRequest(auth, requestId, "rejected");
    if (result && !("error" in result)) removeById(requestId);
  };

  const cancelRequest = async (requestId: string) => {
    // TODO: confirm with teammate whether /respond with "rejected" is correct
    // for canceling an outgoing request, or if a dedicated endpoint is needed.
    const result = await respondToRequest(auth, requestId, "rejected");
    if (result && !("error" in result)) removeById(requestId);
  };

  const allRequests = Array.isArray(requests) ? requests : [];

  const incomingArr = allRequests.filter(
    (r) => r.toUser === user.username && r.status === "pending",
  );
  const outgoingArr = allRequests.filter(
    (r) => r.fromUser === user.username && r.status === "pending",
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

  return { incoming, outgoing, sendRequest, acceptRequest, declineRequest, cancelRequest };
}
