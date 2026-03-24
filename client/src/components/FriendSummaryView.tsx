import "./FriendSummaryView.css";
import type { SafeUserInfo } from "@gamenite/shared";
import UserLink from "./UserLink.tsx";

/**
 * Displays a single accepted friend as part of a friends list.
 * Shows their username (linked to their profile), how long you've been
 * friends, and a remove button.
 */
export default function FriendSummaryView({
  username,
  display,
  createdAt,
  onRemove,
}: SafeUserInfo & { onRemove: (username: string) => void }) {
  return (
    <div className="friendSummary" role="listitem">
      <UserLink user={{ username, display, createdAt }} capitalize />
      <button className="secondary narrow" onClick={() => onRemove(username)}>
        Remove
      </button>
    </div>
  );
}
