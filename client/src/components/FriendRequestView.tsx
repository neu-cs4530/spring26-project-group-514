import type { FriendRequest } from "@gamenite/shared";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";
import { CheckIcon, CrossIcon } from "../components/Icons";

/**
 * Displays a single pending friend request.
 * - `direction="incoming"`: shows Accept / Decline buttons
 * - `direction="outgoing"`: shows a Pending indicator and a Cancel button
 */
export default function FriendRequestView({
  request,
  direction,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  direction: "incoming" | "outgoing";
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
}) {
  const timeSince = useTimeSince();
  const displayName = direction === "incoming" ? request.fromUser : request.toUser;

  return (
    <div role="listitem">
      <div>
        <UserLink user={displayName} />
        <span className="smallAndGray"> · {timeSince(request.createdAt)}</span>
      </div>
      {direction === "incoming" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="primary narrow" onClick={() => onAccept?.(request.id)}>
            <CheckIcon />
          </button>
          <button className="secondary narrow" onClick={() => onDecline?.(request.id)}>
            <CrossIcon />
          </button>
        </div>
      ) : (
        <div>
          <span className="smallAndGray">Pending...</span>
        </div>
      )}
    </div>
  );
}
