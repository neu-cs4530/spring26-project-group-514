import type { FriendRequest } from "@gamenite/shared";
import useTimeSince from "../hooks/useTimeSince.ts";

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
  onCancel,
}: {
  request: FriendRequest;
  direction: "incoming" | "outgoing";
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}) {
  const timeSince = useTimeSince();
  const displayName = direction === "incoming" ? request.fromUser : request.toUser;

  return (
    <div className="dottedListItem" role="listitem">
      <div>
        <strong>{displayName}</strong>
        <span className="smallAndGray"> · {timeSince(request.createdAt)}</span>
      </div>
      {direction === "incoming" ? (
        <div>
          <button className="primary narrow" onClick={() => onAccept?.(request.id)}>
            Accept
          </button>
          <button className="secondary narrow" onClick={() => onDecline?.(request.id)}>
            Decline
          </button>
        </div>
      ) : (
        <div>
          <span className="smallAndGray">Pending...</span>
          <button className="secondary narrow" onClick={() => onCancel?.(request.id)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
