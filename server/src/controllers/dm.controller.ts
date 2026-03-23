import { type DirectChatInfo } from "@gamenite/shared";
import { getDmList } from "../services/dm.service.ts";
import { type RestAPI } from "../types.ts";

/**
 * Handles getting all DM conversations for a user.
 */
export const getList: RestAPI<DirectChatInfo[], { username: string }> = async (req, res) => {
  try {
    const chats = await getDmList(req.params.username);
    res.send(chats);
  } catch {
    res.status(404).send({ error: "User not found" });
  }
};
