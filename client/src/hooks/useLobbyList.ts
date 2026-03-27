import type { ErrorMsg, LobbyInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { getLobbyList } from "../services/lobbyService.ts";

/**
 * This retrieves public lobby list for the lobby browser page.
 */
export default function useLobbyList(): { message: string } | LobbyInfo[] {
  const [lobbies, setLobbies] = useState<LobbyInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    getLobbyList().then(setLobbies);
  }, []);

  if (!lobbies) return { message: "Loading..." };
  if ("error" in lobbies) return { message: `Error: ${lobbies.error}` };
  if (lobbies.length === 0) return { message: "No public lobbies found..." };
  return lobbies;
}
