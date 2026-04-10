import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSocketsForLobby from "../hooks/useSocketsForLobby.ts";
import useFriendList from "../hooks/useFriendList.ts";
import UserLink from "../components/UserLink.tsx";
import ChatPanel from "../components/ChatPanel.tsx";
import ActionErrorBanner from "../components/ActionErrorBanner.tsx";
import "./Lobby.css";

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
  const [presetName, setPresetName] = useState("");
  const [timerPresets, setTimerPresets] = useState<TimerPreset[]>(() => loadTimerPresets());

  const {
    lobby,
    isHost,
    me,
    startedGameId,
    lobbyError,
    joinLobby,
    leaveLobby,
    declineInvite,
    invitePlayer,
    removePlayer,
    updateSettings,
    startLobby,
  } = useSocketsForLobby(lobbyId!);

  const { friends } = useFriendList();

  const joinedCount = useMemo(
    () => lobby?.players.filter((p) => p.status === "joined").length ?? 0,
    [lobby],
  );

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

  useEffect(() => {
    if (startedGameId) {
      navigate(`/game/${startedGameId}`);
    }
  }, [startedGameId, navigate]);

  if (startedGameId) return null;

  if (!lobby) return <div className="content">Loading lobby...</div>;

  return (
    <div className="lobby-page lobby-layout">
      <div className="lobby-main content">
        <div className="spacedSection">
          <h2>{lobby.type} Lobby</h2>
          <div className="lobby-meta">
            <span>Code: {lobby.code}</span>
            <span>{lobby.isPrivate ? "Private" : "Public"}</span>
            <span>{joinedCount} players joined</span>
          </div>
        </div>

        <div className="spacedSection">
          <h2>Players</h2>
          <div className="list" role="list">
            {lobby.players.map((player) => (
              <div role="listitem" key={player.user.username}>
                <div>
                  <UserLink user={player.user} />{" "}
                  <span className="smallAndGray">({player.status})</span>
                </div>
                {isHost && player.user.username !== lobby.createdBy.username && (
                  <button
                    className="danger narrow"
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
            <h2>Invite Players</h2>
            <div className="invite-row">
              <input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteUsername.trim()) {
                    invitePlayer(inviteUsername.trim());
                    setInviteUsername("");
                  }
                }}
                placeholder="Enter username..."
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
            {Array.isArray(friends) && friends.length > 0 && (
              <>
                <h3>Friends</h3>
                <div className="list" role="list">
                  {friends.map((friend) => (
                    <div role="listitem" key={friend.username}>
                      <UserLink user={friend} />
                      <button
                        className="primary narrow"
                        onClick={() => invitePlayer(friend.username)}
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isHost && (
          <div className="spacedSection">
            <h2>Lobby Settings</h2>
            <div className="settings-grid">
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
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={lobby.settings.timerSeconds === null}
                  onChange={(e) => setNoTimerMode(e.target.checked)}
                />
                No Timer Mode
              </label>
            </div>

            <div className="preset-row">
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
              <label>
                Name
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  aria-label="Preset name"
                />
              </label>
              <button className="secondary narrow" onClick={addTimerPreset}>
                Save Preset
              </button>
            </div>
          </div>
        )}

        <div className="spacedSection">
          {lobbyError && <ActionErrorBanner error={lobbyError} />}
          <div className="actions">
            {!me && !isHost && (
              <button className="primary narrow" onClick={joinLobby}>
                Join Lobby
              </button>
            )}
            {me?.status === "pending" && (
              <>
                <button className="primary narrow" onClick={joinLobby}>
                  Accept Invite
                </button>
                <button className="danger narrow" onClick={declineInvite}>
                  Decline Invite
                </button>
              </>
            )}
            {me?.status === "joined" && !isHost && (
              <button className="danger narrow" onClick={leaveLobby}>
                Leave Lobby
              </button>
            )}
            {isHost && (
              <button className="primary narrow" onClick={startLobby}>
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lobby-chat">
        <h2>Lobby Chat</h2>
        <ChatPanel chatId={lobby.chatId} />
      </div>
    </div>
  );
}
