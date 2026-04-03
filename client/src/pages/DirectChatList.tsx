import { useMemo } from "react";
import useDirectChatList from "../hooks/useDirectChatList.ts";
import useNotifications from "../hooks/useNotifications.ts";
import DirectChatSummaryView from "../components/DirectChatSummaryView.tsx";

/**
 * Displays a list of all DM conversations for the current user.
 * Mirrors the structure of ThreadList.
 */
export default function DirectChatList() {
  const chatList = useDirectChatList();
  const { dmLastMessageAt } = useNotifications();

  const sortedList = useMemo(() => {
    if ("message" in chatList) return chatList;
    return [...chatList].sort((a, b) => {
      const aTime = dmLastMessageAt[a.directChatId] ?? a.lastMessageAt ?? a.createdAt;
      const bTime = dmLastMessageAt[b.directChatId] ?? b.lastMessageAt ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [chatList, dmLastMessageAt]);

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Direct Messages</h2>
        {"message" in sortedList ? (
          <div>{sortedList.message}</div>
        ) : (
          <div className="list" role="list">
            {sortedList.map((chat) => (
              <DirectChatSummaryView {...chat} key={chat.directChatId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
