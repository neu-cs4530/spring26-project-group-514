import "./DirectChatSummaryView.css";
import { NavLink } from "react-router-dom";
import type { DirectChatSummary } from "@gamenite/shared";
import useTimeSince from "../hooks/useTimeSince.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import useNotifications from "../hooks/useNotifications.ts";
import NotificationBadge from "./NotificationBadge.tsx";

/**
 * Summarizes a single DM conversation as part of a list.
 * Shows the other participant's username and links to the conversation.
 */
export default function DirectChatSummaryView({
  directChatId,
  participants,
  createdAt,
  lastMessageAt,
}: DirectChatSummary) {
  const { user } = useLoginContext();
  const { dmUnreads, dmLastMessageAt } = useNotifications();
  const timeSince = useTimeSince();
  const otherUser = participants[0].username === user.username ? participants[1] : participants[0];
  const unreadCount = dmUnreads[directChatId] ?? 0;
  const liveLastMessageAt = dmLastMessageAt[directChatId] ?? lastMessageAt;

  return (
    <NavLink to={`/dm/${directChatId}`} className="directChatSummary" role="listitem">
      <div className="directChatSummary-info">
        <span className="directChatSummary-name">{otherUser.display}</span>
        <span className="smallAndGray">
          {liveLastMessageAt
            ? `Last message ${timeSince(liveLastMessageAt)}`
            : `Started ${timeSince(createdAt)}`}
        </span>
      </div>
      <NotificationBadge count={unreadCount} />
    </NavLink>
  );
}
