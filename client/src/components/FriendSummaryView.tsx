import "./FriendSummaryView.css";
import type { FriendSummary } from "@gamenite/shared";
import UserLink from "./UserLink.tsx";
import useTimeSince from "../hooks/useTimeSince.ts";

/**
 * Displays a single accepted friend as part of a friends list.
 * Shows their username (linked to their profile), how long you've been
 * friends, and a remove button.
 */
export default function FriendSummaryView({
  username,
  friendsSince,
  onRemove,
}: FriendSummary & { onRemove: (username: string) => void }) {
  const timeSince = useTimeSince();

  return (
    <div className="friendSummary" role="listitem">
      <UserLink user={{ username }} capitalize />
      <div className="smallAndGray">Friends since {timeSince(friendsSince)}</div>
      <button className="secondary narrow" onClick={() => onRemove(username)}>
        Remove
      </button>
    </div>
  );
}
