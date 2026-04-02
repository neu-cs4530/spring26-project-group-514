import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import FriendSummaryView from "../components/FriendSummaryView.tsx";
import FriendRequestView from "../components/FriendRequestView.tsx";
import AddFriendForm from "../components/AddFriendForm.tsx";
import useBlockList from "../hooks/useBlockList.ts";
import UserLink from "../components/UserLink.tsx";
import "./Friends.css";

export default function Friends() {
  const { friends, removeFriend } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest } = useFriendRequests();
  const { blockedUsers, blockError, unblockUser } = useBlockList();

  return (
    <div className="content friends-page">
      <AddFriendForm onSend={sendRequest} />

      <div className="spacedSection">
        <h2>Friends</h2>
        {"message" in friends ? (
          <div>{friends.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {friends.map((friend) => (
              <FriendSummaryView {...friend} key={friend.username} onRemove={removeFriend} />
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
