import type { AchievementBadge, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import { getUserBadges, getUserById } from "../services/userService";

interface ViewProfileProps {
  username: string;
}
export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    | { type: "waiting" }
    | { type: "error"; msg: string }
    | { type: "profile"; user: SafeUserInfo; badges: AchievementBadge[] }
  >({ type: "waiting" });
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const timeSince = useTimeSince();
  const { friends } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest } = useFriendRequests();

  const isAlreadyFriend = !("message" in friends) && friends.some((f) => f.username === username);
  const hasPendingOutgoing =
    !("message" in outgoing) && outgoing.some((request) => request.toUser === username);
  const incomingRequest = !("message" in incoming)
    ? incoming.find((request) => request.fromUser === username)
    : null;

  useEffect(() => {
    let cancel = false;

    Promise.all([getUserById(username), getUserBadges(username)])
      .then(([profileResponse, badgeResponse]) => {
        if (cancel) return;
        if ("error" in profileResponse) {
          setComponentState({ type: "error", msg: profileResponse.error });
        } else {
          setComponentState({
            type: "profile",
            user: profileResponse,
            badges: "error" in badgeResponse ? [] : badgeResponse.badges,
          });
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
    setRequestStatus(null);
    await sendRequest(username);
    setRequestStatus("Friend request sent!");
  }

  async function handleAccept(requestId: string) {
    await acceptRequest(requestId);
    setRequestStatus("Friend request accepted!");
  }

  async function handleDecline(requestId: string) {
    await declineRequest(requestId);
    setRequestStatus("Friend request declined.");
  }

  function renderFriendAction() {
    if (isAlreadyFriend) {
      return <div className="smallAndGray">Already friends</div>;
    }

    if (hasPendingOutgoing) {
      return <div className="smallAndGray">Friend request pending...</div>;
    }

    if (incomingRequest) {
      return (
        <div>
          <div className="smallAndGray">This user sent you a friend request.</div>
          <button className="primary narrow" onClick={() => handleAccept(incomingRequest.id)}>
            Accept
          </button>
          <button className="secondary narrow" onClick={() => handleDecline(incomingRequest.id)}>
            Decline
          </button>
        </div>
      );
    }

    return (
      <button className="primary narrow" onClick={handleSendFriendRequest}>
        Send Friend Request
      </button>
    );
  }

  switch (componentState.type) {
    case "error":
      return <div style={{ color: "#f00" }}>{componentState.msg}</div>;
    case "waiting":
      return <div>Loading...</div>;
    case "profile":
      return (
        <>
          <h2>Profile for {componentState.user.display}</h2>
          <div>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>Account created {timeSince(componentState.user.createdAt)}</li>
              <li>
                Badges:{" "}
                {componentState.badges.length > 0 ? componentState.badges.join(", ") : "None yet"}
              </li>
            </ul>
          </div>
          <div>
            {renderFriendAction()}
            {requestStatus && <div className="smallAndGray">{requestStatus}</div>}
          </div>
        </>
      );
  }
}
