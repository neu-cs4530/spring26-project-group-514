import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";
import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";

interface ViewProfileProps {
  username: string;
}

export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    { type: "waiting" } | { type: "error"; msg: string } | { type: "profile"; user: SafeUserInfo }
  >({ type: "waiting" });
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const timeSince = useTimeSince();

  const { friends } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest } = useFriendRequests();

  const isAlreadyFriend = !("message" in friends) && friends.some((f) => f.username === username);

  const hasPendingOutgoing =
    !("message" in outgoing) && outgoing.some((r) => r.toUser === username);

  const incomingRequest = !("message" in incoming)
    ? incoming.find((r) => r.fromUser === username)
    : undefined;

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
