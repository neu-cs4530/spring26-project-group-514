import type { ErrorMsg, LobbyInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import { getInvitedLobbyList, getLobbyList } from "../services/lobbyService.ts";

/**
 * This retrieves public and invited lobby lists for the lobby browser page.
 * Listens for real-time lobby invite notifications via socket.
 */
export default function useLobbyList(): {
  publicLobbies: LobbyInfo[] | ErrorMsg | null;
  invitedLobbies: LobbyInfo[] | ErrorMsg | null;
} {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const [publicLobbies, setPublicLobbies] = useState<LobbyInfo[] | ErrorMsg | null>(null);
  const [invitedLobbies, setInvitedLobbies] = useState<LobbyInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    getLobbyList().then(setPublicLobbies);
    getInvitedLobbyList(auth).then(setInvitedLobbies);
  }, [auth]);

  useEffect(() => {
    const onInviteReceived = (lobby: LobbyInfo) => {
      setInvitedLobbies((prev) => {
        if (!prev || "error" in prev) return [lobby];
        if (prev.some((l) => l.lobbyId === lobby.lobbyId)) return prev;
        return [lobby, ...prev];
      });
    };

    socket.on("lobbyInviteReceived", onInviteReceived);
    return () => {
      socket.off("lobbyInviteReceived", onInviteReceived);
    };
  }, [socket]);

  return { publicLobbies, invitedLobbies };
}
