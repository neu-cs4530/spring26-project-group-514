import { withAuth, type SafeUserInfo } from "@gamenite/shared";
import { blockUser, getBlockList, unblockUser } from "../services/block.service.ts";
import { type RestAPI, type GameServer } from "../types.ts";
import { z } from "zod";
import { checkAuth } from "../services/auth.service.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";

/**
 * Handles blocking a user
 * Emits `userBlocked` to the target user's socket room.
 *
 * @param req request containing auth info and the username to block
 * @param res response either returning the blocked user's info or an error
 */
export const postBlock =
  (io: GameServer): RestAPI<SafeUserInfo> =>
  async (req, res) => {
    const body = withAuth(z.object({ blockedUsername: z.string() })).safeParse(req.body);
    if (body.error) {
      res.status(400).send({ error: "Poorly-formed request" });
      return;
    }

    const user = await checkAuth(body.data.auth);
    if (!user) {
      res.status(403).send({ error: "Invalid credentials" });
      return;
    }

    try {
      const blocked = await blockUser(user.username, body.data.payload.blockedUsername);
      const blockerInfo = await populateSafeUserInfo(user.userId);
      io.to(`user:${body.data.payload.blockedUsername}`).emit("userBlocked", blockerInfo);
      res.send(blocked);
    } catch (e) {
      res.status(400).send({ error: "Bad Request" });
    }
  };

/**
 * POST /api/block/unblock
 * Removes a user from the caller's block list.
 * Body: { auth: { username, password }, payload: { blockedUsername } }
 */
export const postUnblock =
  (io: GameServer): RestAPI<SafeUserInfo> =>
  async (req, res) => {
    const body = withAuth(z.object({ blockedUsername: z.string() })).safeParse(req.body);
    if (body.error) {
      res.status(400).send({ error: "Poorly-formed request" });
      return;
    }
    const user = await checkAuth(body.data.auth);
    if (!user) {
      res.status(403).send({ error: "Invalid credentials" });
      return;
    }
    try {
      const unblocked = await unblockUser(user.username, body.data.payload.blockedUsername);
      const unblockerInfo = await populateSafeUserInfo(user.userId);
      io.to(`user:${body.data.payload.blockedUsername}`).emit("userUnblocked", unblockerInfo);
      res.send(unblocked);
    } catch (e) {
      res.status(400).send({ error: "Bad Request" });
    }
  };

/**
 * GET /api/block/list/:username
 * Returns the caller's block list as SafeUserInfo[].
 * Requires x-password header for authentication.
 */
export const getList: RestAPI<SafeUserInfo[], { username: string }> = async (req, res) => {
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
    const list = await getBlockList(req.params.username);
    res.send(list);
  } catch {
    res.status(404).send({ error: "User not found" });
  }
};
