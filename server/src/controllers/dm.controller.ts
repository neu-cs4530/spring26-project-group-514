import {
  type DirectChatSummary,
  type DirectChatInfo,
  withAuth,
  zNewMessageRequest,
} from "@gamenite/shared";
import { addMessageToDm, getDmById, getDmList } from "../services/dm.service.ts";
import { type RestAPI, type SocketAPI } from "../types.ts";
import { checkAuth, enforceAuth } from "../services/auth.service.ts";
import { z } from "zod";
import { logSocketError } from "./socket.controller.ts";
import { createMessage } from "../services/message.service.ts";

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

/**
 * Handle a socket request to join a DM: verify credentials, check the user
 * is a participant, join the socket to the DM room, and emit the DM info back.
 */
export const socketDmJoin: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: dmId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const chat = await getDmById(dmId);
    if (!chat.participants.includes(user.username)) {
      throw new Error(`user ${user.username} is not a participant of DM ${dmId}`);
    }
    await socket.join(dmId);
    socket.emit("dmJoined", chat);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to leave a DM room: verify credentials and leave
 * the socket room.
 */
export const socketDmLeave: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: dmId } = withAuth(z.string()).parse(body);
    await enforceAuth(auth);
    if (!socket.rooms.has(dmId)) {
      throw new Error("Cannot leave a DM room you are not in");
    }
    await socket.leave(dmId);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to send a message in a DM: verify credentials,
 * check the user is a participant, persist the message, and broadcast it
 * to the DM room.
 */
export const socketDmSendMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, text },
    } = withAuth(zNewMessageRequest).parse(body);
    const user = await enforceAuth(auth);
    const chat = await getDmById(chatId);
    if (!chat.participants.includes(user.username)) {
      throw new Error(`user ${user.username} is not a participant of DM ${chatId}`);
    }
    const message = await createMessage(user, text, new Date());
    await addMessageToDm(chatId, message.messageId);
    io.to(chatId).emit("dmNewMessage", { chatId, message });
  } catch (err) {
    logSocketError(socket, err);
  }
};
