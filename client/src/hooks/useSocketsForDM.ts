import { useEffect, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import type { DirectChatInfo, DmNewMessagePayload, MessageInfo } from "@gamenite/shared";
import useNotifications from "./useNotifications.ts";

/**
 * Custom hook to manage the socket connection for a direct message conversation.
 * Mirrors the pattern of useSocketsForChat but without move log or user-joined events.
 * @throws if outside a LoginContext
 * @returns an object containing
 * - `messages`: The current list of messages in the DM, or null while loading
 * - `handleMessageCreation`: Sends a new DM to the conversation
 */
export default function useSocketsForDM(chatId: string): {
  messages: MessageInfo[] | null;
  handleMessageCreation: (text: string) => void;
} {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const { clearActiveDm } = useNotifications();
  const [messages, setMessages] = useState<MessageInfo[] | null>(null);

  useEffect(() => {
    const handleDMJoined = (chat: DirectChatInfo) => {
      if (chat.id !== chatId) return;
      socket.off("dmJoined", handleDMJoined);
      setMessages(chat.messages);
      socket.on("dmNewMessage", handleNewMessage);
    };

    const handleNewMessage = (payload: DmNewMessagePayload) => {
      if (payload.chatId === chatId) {
        setMessages((oldMessages) => {
          if (!oldMessages) return null;
          return [...oldMessages, payload.message];
        });
      }
    };

    socket.emit("dmJoin", { auth, payload: chatId });
    socket.on("dmJoined", handleDMJoined);

    return () => {
      socket.off("dmJoined", handleDMJoined);
      socket.off("dmNewMessage", handleNewMessage);
      socket.emit("dmLeave", { auth, payload: chatId });
      clearActiveDm();
    };
  }, [socket, auth, chatId, clearActiveDm]);

  function handleMessageCreation(text: string) {
    socket.emit("dmSendMessage", { auth, payload: { chatId, text } });
  }

  return { messages, handleMessageCreation };
}
