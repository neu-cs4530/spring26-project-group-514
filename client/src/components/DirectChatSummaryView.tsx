import "./DirectChatSummaryView.css";
import { NavLink } from "react-router-dom";
import type { DirectChatSummary } from "@gamenite/shared";
import useTimeSince from "../hooks/useTimeSince.ts";
import useLoginContext from "../hooks/useLoginContext.ts";

/**
 * Summarizes a single DM conversation as part of a list.
 * Shows the other participant's username and links to the conversation.
 */
export default function DirectChatSummaryView({
  directChatId,
  participants,
  createdAt,
}: DirectChatSummary) {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();
  const otherUser = participants[0] === user.username ? participants[1] : participants[0];

  return (
    <div className="directChatSummary" role="listitem">
      <NavLink to={`/dm/${directChatId}`} className="mid">
        {otherUser}
      </NavLink>
      <div className="lastActivity smallAndGray">Started {timeSince(createdAt)}</div>
    </div>
  );
}
