import type { ErrorMsg, LobbyInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useAuth from "./useAuth.ts";
import { getInvitedLobbyList, getLobbyList } from "../services/lobbyService.ts";

/**
 * This retrieves public and invited lobby lists for the lobby browser page.
 */
export default function useLobbyList(): {
  publicLobbies: LobbyInfo[] | ErrorMsg | null;
  invitedLobbies: LobbyInfo[] | ErrorMsg | null;
} {
  const auth = useAuth();
  const [publicLobbies, setPublicLobbies] = useState<LobbyInfo[] | ErrorMsg | null>(null);
  const [invitedLobbies, setInvitedLobbies] = useState<LobbyInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    getLobbyList().then(setPublicLobbies);
    getInvitedLobbyList(auth).then(setInvitedLobbies);
  }, [auth]);

  return { publicLobbies, invitedLobbies };
}
