import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import FriendSummaryView from "../components/FriendSummaryView.tsx";
import FriendRequestView from "../components/FriendRequestView.tsx";
import AddFriendForm from "../components/AddFriendForm.tsx";

export default function Friends() {
  const { friends, removeFriend } = useFriendList();
  const { incoming, outgoing, sendRequest, acceptRequest, declineRequest, cancelRequest } =
    useFriendRequests();

  return (
    <div className="content">
      <AddFriendForm onSend={sendRequest} />

      <div className="spacedSection">
        <h2>Friends</h2>
        {"message" in friends ? (
          <div>{friends.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {friends.map((friend) => (
              <FriendSummaryView {...friend} key={friend.user.username} onRemove={removeFriend} />
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
              <FriendRequestView
                key={req.id}
                request={req}
                direction="outgoing"
                onCancel={cancelRequest}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
