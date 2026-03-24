import { type DirectChatSummary } from "@gamenite/shared";
import { getDmList } from "../services/dm.service.ts";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Handles getting all DM conversations for a user.
 */
export const getList: RestAPI<DirectChatSummary[], { username: string }> = async (req, res) => {
  const password = req.headers["x-password"];
  if (typeof password !== "string") {
    res.status(400).send({ error: "Missing password header" });
    return;
  }

  const user = await checkAuth({ username: req.params.username, password });
  if (!user) {
    res.status(401).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const chats = await getDmList(req.params.username);
    res.send(chats);
  } catch {
    res.status(500).send({ error: "Failed to retrieve DMs" });
  }
};
