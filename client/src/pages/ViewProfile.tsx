import type { MatchHistoryEntry, PlayerStats, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";
import useFriendList from "../hooks/useFriendList.ts";
import useFriendRequests from "../hooks/useFriendRequests.ts";
import useBlockList from "../hooks/useBlockList.ts";
import ConfirmModal from "../components/ConfirmModal";
import "./ViewProfile.css";
import { BlockedIcon, CheckIcon, CrossIcon } from "../components/Icons";
import useAuth from "../hooks/useAuth.ts";
import { getMatchHistory, getPlayerStats } from "../services/statsService.ts";

interface ViewProfileProps {
  username: string;
}

export default function ViewProfile({ username }: ViewProfileProps) {
  const auth = useAuth();
  const [componentState, setComponentState] = useState<
    { type: "waiting" } | { type: "error"; msg: string } | { type: "profile"; user: SafeUserInfo }
  >({ type: "waiting" });
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [recentHistory, setRecentHistory] = useState<MatchHistoryEntry[]>([]);
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

  useEffect(() => {
    let cancel = false;

    getPlayerStats(username).then((res) => {
      if (cancel || "error" in res) return;
      setPlayerStats(res);
    });

    getMatchHistory(username, 1, 5).then((res) => {
      if (cancel || "error" in res) return;
      setRecentHistory(res.data);
    });

    return () => {
      cancel = true;
    };
  }, [username]);

  useEffect(() => {
    let cancel = false;
    getPlayerStats(auth.username).then((res) => {
      if (cancel || "error" in res) return;
      setMyStats(res);
    });
    return () => {
      cancel = true;
    };
  }, [auth.username]);

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

          {playerStats && (
            <div className="spacedSection">
              <h3>Stats</h3>
              <ul>
                <li>Total Wins: {playerStats.wins}</li>
                <li>Total Losses: {playerStats.losses}</li>
                <li>Games Played: {playerStats.gamesPlayed}</li>
                <li>Win Rate: {(playerStats.winRate * 100).toFixed(1)}%</li>
              </ul>
              <div>
                <strong>Badges:</strong>{" "}
                {playerStats.badges.length > 0 ? playerStats.badges.join(", ") : "No badges yet"}
              </div>
            </div>
          )}

          <div className="spacedSection">
            <h3>Recent Matches</h3>
            {recentHistory.length === 0 ? (
              <div className="smallAndGray">No completed matches yet.</div>
            ) : (
              <div className="dottedList" role="list">
                {recentHistory.map((entry) => (
                  <div className="dottedListItem" role="listitem" key={entry.gameId}>
                    <div>
                      {entry.type} - {entry.result.toUpperCase()} (
                      {new Date(entry.endedAt).toLocaleDateString()})
                    </div>
                    <div className="smallAndGray">
                      Opponents: {entry.players.filter((p) => p !== username).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {username !== auth.username && isAlreadyFriend && playerStats && myStats && (
            <div className="spacedSection">
              <h3>Friend Comparison</h3>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>You</th>
                    <th>{componentState.user.display}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Wins</td>
                    <td>{myStats.wins}</td>
                    <td>{playerStats.wins}</td>
                  </tr>
                  <tr>
                    <td>Losses</td>
                    <td>{myStats.losses}</td>
                    <td>{playerStats.losses}</td>
                  </tr>
                  <tr>
                    <td>Win Rate</td>
                    <td>{(myStats.winRate * 100).toFixed(1)}%</td>
                    <td>{(playerStats.winRate * 100).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
  }
}
