import { type DirectChatSummary, type DirectChatInfo } from "@gamenite/shared";
import { getDmById, getDmList } from "../services/dm.service.ts";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Handles getting all DM conversations for a user.
 * Requires x-password headers for authentication.
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

/**
 * Handles getting a specific DM conversation by ID.
 * Requires x-username and x-password headers for authentication.
 * Returns 403 if the authenticated user is not a participant.
 */
export const getById: RestAPI<DirectChatInfo, { id: string }> = async (req, res) => {
  const password = req.headers["x-password"];
  const username = req.headers["x-username"];
  if (typeof password !== "string" || typeof username !== "string") {
    res.status(400).send({ error: "Missing auth headers" });
    return;
  }

  const user = await checkAuth({ username, password });
  if (!user) {
    res.status(401).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const chat = await getDmById(req.params.id);
    if (!chat.participants.includes(user.username)) {
      res.status(403).send({ error: "Forbidden" });
      return;
    }
    res.send(chat);
  } catch {
    res.status(404).send({ error: "DM not found" });
  }
};
