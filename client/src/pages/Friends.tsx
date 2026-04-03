import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import FriendSummaryView from "../components/FriendSummaryView.tsx";
import FriendRequestView from "../components/FriendRequestView.tsx";
import AddFriendForm from "../components/AddFriendForm.tsx";
import useBlockList from "../hooks/useBlockList.ts";
import UserLink from "../components/UserLink.tsx";
import "./Friends.css";
import { useState } from "react";
import useActionError from "../hooks/useActionError.ts";
import ConfirmModal from "../components/ConfirmModal.tsx";
import ActionErrorBanner from "../components/ActionErrorBanner.tsx";
import type { SafeUserInfo } from "@gamenite/shared";

export default function Friends() {
  const { friends, removeFriend } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest } = useFriendRequests();
  const { blockedUsers, blockError, unblockUser } = useBlockList();
  const { actionError, setActionError } = useActionError();
  const [friendToRemove, setRemoveFriend] = useState<SafeUserInfo | null>(null);

  function handleRemove(friend: SafeUserInfo) {
    setRemoveFriend(friend);
  }

  async function handleConfirmRemove() {
    if (!friendToRemove) return;
    const error = await removeFriend(friendToRemove.username);
    if (error) setActionError(error);
    setRemoveFriend(null);
  }

  async function handleSend(username: string): Promise<string | null> {
    const error = await sendRequest(username);
    if (error) {
      setActionError(error);
      return error;
    }
    return null;
  }

  return (
    <div className="content friends-page">
      {friendToRemove && (
        <ConfirmModal
          message={`Removing existing friendship will delete all DM messages.\n Are you sure you want to remove ${friendToRemove.display}`}
          confirmLabel="Yes, Remove"
          cancelLabel="No"
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveFriend(null)}
        />
      )}
      {actionError && <ActionErrorBanner error={actionError} />}
      <AddFriendForm onSend={handleSend} />
      <div className="spacedSection">
        <h2>Friends</h2>
        {"message" in friends ? (
          <div>{friends.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {friends.map((friend) => (
              <FriendSummaryView {...friend} key={friend.username} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>

      <div className="spacedSection">
        <h2>Incoming Requests</h2>
        {"message" in incoming ? (
          <div>{incoming.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {incoming.map((req) => (
              <FriendRequestView
                key={req.id}
                request={req}
                direction="incoming"
                onAccept={acceptRequest}
                onDecline={declineRequest}
              />
            ))}
          </div>
        )}
      </div>

      <div className="spacedSection">
        <h2>Sent Requests</h2>
        {"message" in outgoing ? (
          <div>{outgoing.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {outgoing.map((req) => (
              <FriendRequestView key={req.id} request={req} direction="outgoing" />
            ))}
          </div>
        )}
      </div>

      <div className="spacedSection">
        <h2>Blocked Users</h2>
        {blockError ? (
          <div>{blockError}</div>
        ) : blockedUsers.length === 0 ? (
          <div>No blocked users.</div>
        ) : (
          <div className="dottedList" role="list">
            {blockedUsers.map((user) => (
              <div key={user.username} role="listitem">
                <UserLink user={user} />
                <button className="outline narrow" onClick={() => unblockUser(user.username)}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
