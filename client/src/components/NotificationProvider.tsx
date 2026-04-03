import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { NotificationContext } from "../contexts/NotificationContext.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import { getDMList } from "../services/dmService.ts";
import { getPendingRequests } from "../services/friendService.ts";
import type { DirectChatInfo, FriendRequest, SafeUserInfo } from "@gamenite/shared";

export default function NotificationProvider({ children }: { children: JSX.Element }) {
  const { user, pass, socket } = useLoginContext();

  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [dmUnreads, setDmUnreads] = useState<Record<string, number>>({});
  const [dmLastMessageAt, setDmLastMessageAt] = useState<Record<string, Date>>({});
  const [activeDmId, setActiveDmId] = useState<string | null>(null);

  // Fetch initial friend request count
  useEffect(() => {
    getPendingRequests(user.username).then((result) => {
      if (Array.isArray(result)) {
        const incoming = result.filter(
          (r: FriendRequest) => r.toUser.username === user.username && r.status === "pending",
        );
        setFriendRequestCount(incoming.length);
      }
    });
  }, [user.username]);

  // Fetch initial DM unread counts
  useEffect(() => {
    getDMList(user.username, pass).then((result) => {
      if (Array.isArray(result)) {
        const unreads: Record<string, number> = {};
        const lastMessages: Record<string, Date> = {};
        for (const dm of result) {
          unreads[dm.directChatId] = dm.unreadCount;
          if (dm.lastMessageAt) {
            lastMessages[dm.directChatId] = new Date(dm.lastMessageAt);
          }
        }
        setDmUnreads(unreads);
        setDmLastMessageAt(lastMessages);
      }
    });
  }, [user.username, pass]);

  // Friend request socket listeners
  useEffect(() => {
    const handleReceived = (req: FriendRequest) => {
      if (req.toUser.username === user.username) {
        setFriendRequestCount((c) => c + 1);
      }
    };

    const handleUpdated = (req: FriendRequest) => {
      if (req.toUser.username === user.username && req.status !== "pending") {
        setFriendRequestCount((c) => Math.max(0, c - 1));
      }
    };

    const handleBlocked = (blocker: SafeUserInfo) => {
      // If blocked user had a pending incoming request, decrement
      setFriendRequestCount((c) => Math.max(0, c - 1));
    };

    socket.on("friendRequestReceived", handleReceived);
    socket.on("friendRequestUpdated", handleUpdated);
    socket.on("userBlocked", handleBlocked);

    return () => {
      socket.off("friendRequestReceived", handleReceived);
      socket.off("friendRequestUpdated", handleUpdated);
      socket.off("userBlocked", handleBlocked);
    };
  }, [socket, user.username]);

  // DM unread socket listeners
  useEffect(() => {
    const handleUnreadNotification = (payload: { chatId: string; lastMessageAt: Date }) => {
      if (payload.chatId === activeDmId) return;
      setDmUnreads((prev) => ({
        ...prev,
        [payload.chatId]: (prev[payload.chatId] ?? 0) + 1,
      }));
      setDmLastMessageAt((prev) => ({
        ...prev,
        [payload.chatId]: new Date(payload.lastMessageAt),
      }));
    };

    const handleDmJoined = (chat: DirectChatInfo) => {
      setActiveDmId(chat.id);
      setDmUnreads((prev) => ({ ...prev, [chat.id]: 0 }));
    };

    socket.on("dmUnreadNotification", handleUnreadNotification);
    socket.on("dmJoined", handleDmJoined);

    return () => {
      socket.off("dmUnreadNotification", handleUnreadNotification);
      socket.off("dmJoined", handleDmJoined);
    };
  }, [socket, activeDmId]);

  const markDmRead = useCallback((chatId: string) => {
    setDmUnreads((prev) => ({ ...prev, [chatId]: 0 }));
  }, []);

  const totalUnreadMessages = Object.values(dmUnreads).reduce((sum, c) => sum + c, 0);

  const clearActiveDm = useCallback(() => {
    setActiveDmId(null);
  }, []);

  const value = useMemo(
    () => ({
      friendRequestCount,
      totalUnreadMessages,
      dmUnreads,
      dmLastMessageAt,
      markDmRead,
      clearActiveDm,
    }),
    [
      friendRequestCount,
      totalUnreadMessages,
      dmUnreads,
      dmLastMessageAt,
      markDmRead,
      clearActiveDm,
    ],
  );

  return <NotificationContext value={value}>{children}</NotificationContext>;
}
