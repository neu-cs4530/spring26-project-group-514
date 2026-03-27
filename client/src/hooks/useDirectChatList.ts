import type { DirectChatSummary, ErrorMsg } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { getDMList } from "../services/dmService.ts";
import useLoginContext from "./useLoginContext.ts";

/**
 * Custom hook to get the list of all DM conversations for the current user.
 * @returns A message to display to the user (Loading... or an error message), or a list
 */
export default function useDirectChatList(): { message: string } | DirectChatSummary[] {
  const { user, pass } = useLoginContext();
  const [chats, setChats] = useState<DirectChatSummary[] | ErrorMsg | null>(null);

  useEffect(() => {
    getDMList(user.username, pass).then(setChats);
  }, [user.username, pass]);

  if (!chats) return { message: "Loading..." };
  if ("error" in chats) return { message: `Error: ${chats.error}` };
  if (chats.length === 0) return { message: "No conversations yet..." };
  return chats;
}
