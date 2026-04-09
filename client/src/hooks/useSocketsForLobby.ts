import { useEffect, useState } from "react";
import type { LobbyInfo, LobbySettingsPayload } from "@gamenite/shared";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";

/**
 * Manages socket-backed realtime lobby updates and actions.
 */
export default function useSocketsForLobby(lobbyId: string) {
  const auth = useAuth();
  const { user, socket } = useLoginContext();
  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [startedGameId, setStartedGameId] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  useEffect(() => {
    const onLobbyUpdated = (payload: LobbyInfo) => {
      if (payload.lobbyId !== lobbyId) return;
      setLobby(payload);
      if (payload.startedGameId) {
        setStartedGameId(payload.startedGameId);
      }
    };

    const onLobbyStarted = (payload: { lobbyId: string; gameId: string }) => {
      if (payload.lobbyId !== lobbyId) return;
      setStartedGameId(payload.gameId);
    };

    const onLobbyError = (payload: { lobbyId: string; error: string }) => {
      if (payload.lobbyId !== lobbyId) return;
      setLobbyError(payload.error);
    };

    socket.on("lobbyUpdated", onLobbyUpdated);
    socket.on("lobbyStarted", onLobbyStarted);
    socket.on("lobbyError", onLobbyError);
    socket.emit("lobbyWatch", { auth, payload: lobbyId });

    return () => {
      socket.off("lobbyUpdated", onLobbyUpdated);
      socket.off("lobbyStarted", onLobbyStarted);
      socket.off("lobbyError", onLobbyError);
      socket.emit("lobbyUnwatch", { auth, payload: lobbyId });
    };
  }, [socket, auth, lobbyId]);

  const me = lobby?.players.find((p) => p.user.username === user.username);
  const isHost = lobby?.createdBy.username === user.username;

  function joinLobby() {
    socket.emit("lobbyJoin", { auth, payload: lobbyId });
  }

  function leaveLobby() {
    socket.emit("lobbyLeave", { auth, payload: lobbyId });
  }

  function declineInvite() {
    socket.emit("lobbyDeclineInvite", { auth, payload: lobbyId });
  }

  function invitePlayer(username: string) {
    socket.emit("lobbyInvitePlayer", { auth, payload: { lobbyId, username } });
  }

  function removePlayer(username: string) {
    socket.emit("lobbyRemovePlayer", { auth, payload: { lobbyId, username } });
  }

  function updateSettings(settings: LobbySettingsPayload) {
    socket.emit("lobbyUpdateSettings", { auth, payload: { lobbyId, settings } });
  }

  function startLobby() {
    setLobbyError(null);
    socket.emit("lobbyStart", { auth, payload: lobbyId });
  }

  return {
    lobby,
    me,
    isHost,
    startedGameId,
    lobbyError,
    joinLobby,
    leaveLobby,
    declineInvite,
    invitePlayer,
    removePlayer,
    updateSettings,
    startLobby,
  };
}
