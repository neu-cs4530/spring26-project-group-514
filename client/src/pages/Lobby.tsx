import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSocketsForLobby from "../hooks/useSocketsForLobby.ts";
import useFriendList from "../hooks/useFriendList.ts";
import UserLink from "../components/UserLink.tsx";
import ChatPanel from "../components/ChatPanel.tsx";

const TIMER_PRESETS_KEY = "gamenite:lobbyTimerPresets";

interface TimerPreset {
  name: string;
  seconds: number;
}

function loadTimerPresets(): TimerPreset[] {
  try {
    const raw = localStorage.getItem(TIMER_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is TimerPreset => {
        if (!entry || typeof entry !== "object") return false;
        const maybeEntry = entry as Record<string, unknown>;
        return (
          typeof maybeEntry.name === "string" &&
          typeof maybeEntry.seconds === "number" &&
          Number.isFinite(maybeEntry.seconds) &&
          maybeEntry.seconds > 0
        );
      })
      .map((entry) => ({ name: entry.name.trim(), seconds: Math.floor(entry.seconds) }))
      .filter((entry) => entry.name.length > 0);
  } catch {
    return [];
  }
}

function saveTimerPresets(presets: TimerPreset[]) {
  localStorage.setItem(TIMER_PRESETS_KEY, JSON.stringify(presets));
}

export default function Lobby() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const [inviteUsername, setInviteUsername] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [timerPresets, setTimerPresets] = useState<TimerPreset[]>(() => loadTimerPresets());

  const {
    lobby,
    isHost,
    me,
    startedGameId,
    joinLobby,
    leaveLobby,
    declineInvite,
    invitePlayer,
    removePlayer,
    updateSettings,
    startLobby,
  } = useSocketsForLobby(lobbyId!);

  const { friends } = useFriendList();
  const lobbyLink = useMemo(() => `${window.location.origin}/lobby/${lobbyId}`, [lobbyId]);

  const joinedCount = useMemo(
    () => lobby?.players.filter((p) => p.status === "joined").length ?? 0,
    [lobby],
  );

  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = setTimeout(() => setCopyFeedback(null), 2000);
    return () => clearTimeout(timeout);
  }, [copyFeedback]);

  function setNoTimerMode(enabled: boolean) {
    if (!lobby) return;
    updateSettings({
      ...lobby.settings,
      timerSeconds: enabled ? null : (lobby.settings.timerSeconds ?? 60),
    });
  }

  function applyTimerPreset(seconds: number) {
    if (!lobby) return;
    updateSettings({
      ...lobby.settings,
      timerSeconds: seconds,
    });
  }

  function addTimerPreset() {
    if (!lobby) return;
    const name = presetName.trim();
    const seconds = lobby.settings.timerSeconds;
    if (!name || seconds === null || seconds <= 0) return;

    const next = [
      ...timerPresets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
      { name, seconds },
    ];

    setTimerPresets(next);
    saveTimerPresets(next);
    setPresetName("");
  }

  async function copyLobbyLink() {
    try {
      await navigator.clipboard.writeText(lobbyLink);
      setCopyFeedback("Copied link");
    } catch {
      setCopyFeedback("Unable to copy");
    }
  }

  useEffect(() => {
    if (startedGameId) {
      navigate(`/game/${startedGameId}`);
    }
  }, [startedGameId, navigate]);

  if (startedGameId) return null;

  if (!lobby) return <div className="content">Loading lobby...</div>;

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>{lobby.type} Lobby</h2>
        <div>Code: {lobby.code}</div>
        <div>{lobby.isPrivate ? "Private" : "Public"}</div>
        <div>{joinedCount} players joined</div>
      </div>

      <div className="spacedSection">
        <h3>Players</h3>
        <div className="dottedList" role="list">
          {lobby.players.map((player) => (
            <div className="dottedListItem" role="listitem" key={player.user.username}>
              <div>
                <UserLink user={player.user} /> ({player.status})
              </div>
              {isHost && player.user.username !== lobby.createdBy.username && (
                <button
                  className="primary narrow"
                  onClick={() => removePlayer(player.user.username)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="spacedSection">
          <h3>Invite Players</h3>
          <div className="alignCenter">
            <input value={lobbyLink} readOnly aria-label="Lobby invite link" />
            <button className="primary narrow" onClick={copyLobbyLink}>
              Copy Link
            </button>
          </div>
          {copyFeedback && <div className="smallAndGray">{copyFeedback}</div>}
          <div className="alignCenter">
            <input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Username"
              aria-label="Invite username"
            />
            <button
              className="primary narrow"
              onClick={() => {
                if (!inviteUsername.trim()) return;
                invitePlayer(inviteUsername.trim());
                setInviteUsername("");
              }}
            >
              Invite
            </button>
          </div>
          {Array.isArray(friends) && (
            <div className="dottedList" role="list">
              {friends.map((friend) => (
                <div className="dottedListItem" role="listitem" key={friend.username}>
                  <div>{friend.username}</div>
                  <button className="primary narrow" onClick={() => invitePlayer(friend.username)}>
                    Invite Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isHost && (
        <div className="spacedSection">
          <h3>Lobby Settings</h3>
          <div className="alignCenter">
            <label>
              Mode
              <select
                value={lobby.settings.mode}
                onChange={(e) =>
                  updateSettings({
                    ...lobby.settings,
                    mode: e.target.value as "standard" | "casual",
                  })
                }
              >
                <option value="standard">Standard</option>
                <option value="casual">Casual</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                value={lobby.settings.difficulty}
                onChange={(e) =>
                  updateSettings({
                    ...lobby.settings,
                    difficulty: e.target.value as "normal" | "hard",
                  })
                }
              >
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>
              Timer (seconds)
              <input
                type="number"
                min={1}
                value={lobby.settings.timerSeconds ?? ""}
                disabled={lobby.settings.timerSeconds === null}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateSettings({
                    ...lobby.settings,
                    timerSeconds: value ? Number(value) : null,
                  });
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={lobby.settings.timerSeconds === null}
                onChange={(e) => setNoTimerMode(e.target.checked)}
              />
              No Timer Mode
            </label>
          </div>

          <div className="alignCenter">
            <label>
              Preset
              <select
                aria-label="Timer preset"
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  applyTimerPreset(Number(value));
                }}
              >
                <option value="">- Select preset -</option>
                {timerPresets.map((preset) => (
                  <option key={preset.name} value={preset.seconds}>
                    {preset.name} ({preset.seconds}s)
                  </option>
                ))}
              </select>
            </label>

            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              aria-label="Preset name"
            />
            <button className="secondary narrow" onClick={addTimerPreset}>
              Save Preset
            </button>
          </div>
        </div>
      )}

      <div className="spacedSection">
        {me?.status === "pending" && (
          <>
            <button className="primary narrow" onClick={joinLobby}>
              Accept Invite
            </button>
            <button className="primary narrow" onClick={declineInvite}>
              Decline Invite
            </button>
          </>
        )}
        {me?.status === "joined" && !isHost && (
          <button className="primary narrow" onClick={leaveLobby}>
            Leave Lobby
          </button>
        )}
        {isHost && (
          <button className="primary narrow" onClick={startLobby}>
            Start Game
          </button>
        )}
      </div>

      <div className="spacedSection">
        <h3>Lobby Chat</h3>
        <ChatPanel chatId={lobby.chatId} />
      </div>
    </div>
  );
}
