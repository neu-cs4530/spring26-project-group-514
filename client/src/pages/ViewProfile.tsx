import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";
import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import useBlockList from "../hooks/useBlockList.ts";
import ConfirmModal from "../components/ConfirmModal";
import "./ViewProfile.css";
import { BlockedIcon, CheckIcon, CrossIcon } from "../components/Icons";
import useActionError from "../hooks/useActionError.ts";
import ActionErrorBanner from "../components/ActionErrorBanner.tsx";

interface ViewProfileProps {
  username: string;
}

export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    { type: "waiting" } | { type: "error"; msg: string } | { type: "profile"; user: SafeUserInfo }
  >({ type: "waiting" });
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const timeSince = useTimeSince();
  const { blockedSet, blockUser, unblockUser } = useBlockList();
  const { friends } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest } = useFriendRequests();
  const { actionError, setActionError } = useActionError();

  const isBlocked = blockedSet.has(username);

  const isAlreadyFriend = !("message" in friends) && friends.some((f) => f.username === username);

  const hasPendingOutgoing =
    !("message" in outgoing) && outgoing.some((r) => r.toUser.username === username);

  const incomingRequest = !("message" in incoming)
    ? incoming.find((r) => r.fromUser.username === username)
    : undefined;

  const [sending, setSending] = useState(false);
  const requestStatus = isAlreadyFriend
    ? "friends"
    : hasPendingOutgoing
      ? "sent"
      : incomingRequest
        ? "incoming"
        : "idle";

  useEffect(() => {
    let cancel = false;

    getUserById(username)
      .then((response) => {
        if (cancel) return;
        if ("error" in response) {
          setComponentState({ type: "error", msg: response.error });
        } else {
          setComponentState({ type: "profile", user: response });
        }
      })
      .catch((err) => {
        if (cancel) return;
        setComponentState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancel = true;
    };
  }, [username]);

  async function handleSendFriendRequest() {
    setSending(true);
    const error = await sendRequest(username);
    setSending(false);
    if (error) setActionError(error);
  }

  async function handleAccept(requestId: string) {
    const error = await acceptRequest(requestId);
    if (error) setActionError(error);
  }

  async function handleDecline(requestId: string) {
    const error = await declineRequest(requestId);
    if (error) setActionError(error);
  }

  async function handleToggleBlock() {
    if (isBlocked) {
      const error = await unblockUser(username);
      if (error) setActionError(error);
    } else {
      setShowBlockConfirm(true);
    }
  }

  async function handleConfirmBlock() {
    setShowBlockConfirm(false);
    const error = await blockUser(username);
    if (error) setActionError(error);
  }

  function renderFriendAction() {
    if (isBlocked) {
      return (
        <button className="outline-blocked narrow" disabled>
          <BlockedIcon />
          Blocked
        </button>
      );
    }
    if (sending) {
      return (
        <button className="secondary narrow" disabled>
          Sending...
        </button>
      );
    }
    switch (requestStatus) {
      case "friends":
        return (
          <button className="outline-friend narrow" disabled>
            Friends
          </button>
        );
      case "incoming":
        return (
          <div>
            <div className="smallAndGray">Wanna be friends?</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="primary narrow" onClick={() => handleAccept(incomingRequest!.id)}>
                <CheckIcon />
              </button>
              <button
                className="secondary narrow"
                onClick={() => handleDecline(incomingRequest!.id)}
              >
                <CrossIcon />
              </button>
            </div>
          </div>
        );
      case "sent":
        return (
          <button className="outline-primary narrow" disabled>
            Request Sent
          </button>
        );
      default:
        return (
          <button className="primary narrow" onClick={handleSendFriendRequest}>
            Add Friend
          </button>
        );
    }
  }

  switch (componentState.type) {
    case "error":
      return (
        <div className="profile-page">
          <div style={{ color: "error-text" }}>{componentState.msg}</div>
        </div>
      );
    case "waiting":
      return (
        <div className="profile-page">
          <div>Loading...</div>
        </div>
      );
    case "profile":
      return (
        <div className="profile-page">
          {showBlockConfirm && (
            <ConfirmModal
              message={`Blocking will remove existing friendship, friend request, and DM messages.\nAre you sure you want to block ${componentState.user.display}?`}
              confirmLabel="Yes, Block"
              cancelLabel="No"
              onConfirm={handleConfirmBlock}
              onCancel={() => setShowBlockConfirm(false)}
            />
          )}
          {actionError && <ActionErrorBanner error={actionError} />}
          <div className="profile-actions">
            {renderFriendAction()}
            <button
              className={isBlocked ? "outline-unblock narrow" : "danger narrow"}
              onClick={handleToggleBlock}
            >
              {isBlocked ? "Unblock" : "Block"}
            </button>
          </div>
          <h2>Profile for {componentState.user.display}</h2>
          <div>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>Account created {timeSince(componentState.user.createdAt)}</li>
            </ul>
          </div>
        </div>
      );
  }
}
