import useDirectChatList from "../hooks/useDirectChatList.ts";
import DirectChatSummaryView from "../components/DirectChatSummaryView.tsx";

/**
 * Displays a list of all DM conversations for the current user.
 * Mirrors the structure of ThreadList.
 */
export default function DirectChatList() {
  const chatList = useDirectChatList();

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Direct Messages</h2>
        {"message" in chatList ? (
          <div>{chatList.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {chatList.map((chat) => (
              <DirectChatSummaryView {...chat} key={chat.directChatId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
