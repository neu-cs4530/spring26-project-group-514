import { useParams } from "react-router-dom";
import useSocketsForDM from "../hooks/useSocketsForDM.ts";
import NewDirectMessage from "../components/NewDirectMessage.tsx";
import useLoginContext from "../hooks/useLoginContext.ts";

/**
 * Displays a single DM conversation with real-time messaging.
 * Mirrors the structure of ThreadPage / ChatPanel.
 */
export default function DirectChatPage() {
  const { chatId } = useParams();
  const { user } = useLoginContext();

  // Non-nullish assertion is okay here given that DirectChatPage is only
  // called in a route with `:chatId` on the path
  const { messages, handleMessageCreation } = useSocketsForDM(chatId!);

  return (
    <div className="content">
      <div className="spacedSection">
        {messages === null ? (
          <div>Loading...</div>
        ) : (
          <>
            <div className="dottedList" role="list">
              {messages.map(({ messageId, text, createdBy, createdAt }) => (
                <div className="dottedListItem" role="listitem" key={messageId}>
                  <div>{text}</div>
                  <div className="smallAndGray">
                    {createdBy.username === user.username ? "You" : createdBy.username}
                  </div>
                </div>
              ))}
            </div>
            <NewDirectMessage handleMessageCreation={handleMessageCreation} />
          </>
        )}
      </div>
    </div>
  );
}
