import "./DirectChatPage.css";
import { useParams } from "react-router-dom";
import useSocketsForDM from "../hooks/useSocketsForDM.ts";
import NewDirectMessage from "../components/NewDirectMessage.tsx";
import MessageList from "../components/MessageList.tsx";
import type { ChatMessage } from "../util/types.ts";

/**
 * Displays a single DM conversation with real-time messaging.
 * Reuses MessageList for consistent chat rendering with auto-scroll
 * and me/other bubble styling.
 */
export default function DirectChatPage() {
  const { chatId } = useParams();

  // Non-nullish assertion is okay here given that DirectChatPage is only
  // called in a route with `:chatId` on the path
  const { messages, handleMessageCreation } = useSocketsForDM(chatId!);

  return messages ? (
    <div className="dmContainer">
      <MessageList messages={messages as ChatMessage[]} />
      <NewDirectMessage handleMessageCreation={handleMessageCreation} />
    </div>
  ) : (
    <div>Loading...</div>
  );
}
