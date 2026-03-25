import { withAuth, type FriendRequest, type SafeUserInfo } from "@gamenite/shared";
import {
  getFriendsList,
  getPendingRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
} from "../services/friend.service.ts";
import { type RestAPI, type GameServer } from "../types.ts";
import { z } from "zod";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Handles getting a user's friend list
 * @param req The request containing the username as a route parameter.
 * @param res The response, either returning the friend list or an error.
 */
export const getList: RestAPI<SafeUserInfo[], { username: string }> = async (req, res) => {
  try {
    const friends = await getFriendsList(req.params.username);
    res.send(friends);
  } catch {
    res.status(404).send({ error: "User not found" });
  }
};

/**
 * Handles getting a user's incoming/outgoing friend requests
 *
 * @param req The request containing the username as a route parameter.
 * @param res The response, either returning the incoming/outgoing friend requests or an error.
 */
export const getRequests: RestAPI<FriendRequest[], { username: string }> = async (req, res) => {
  try {
    const friendReqs = await getPendingRequests(req.params.username);
    res.send(friendReqs);
  } catch {
    res.status(404).send({ error: "User not found" });
  }
};

/**
 * Handles sending friend request from one user to another
 * Emits `friendRequestReceived` to the target user's socket room.
 *
 * @param io the Socket.io server instance used to emit the event.
 * @param req request containing auth. info of user and username of requested friend.
 * @param res response either returning the friend request or an error.
 */
export const postRequest =
  (io: GameServer): RestAPI<FriendRequest> =>
  async (req, res) => {
    const body = withAuth(z.object({ toUsername: z.string() })).safeParse(req.body);
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
      const friendReq = await sendFriendRequest(user.username, body.data.payload.toUsername);
      io.to(`user:${body.data.payload.toUsername}`).emit("friendRequestReceived", friendReq);
      res.send(friendReq);
    } catch (e) {
      res.status(400).send({ error: "Bad Request" });
    }
  };

/**
 * Handles responding to a friend request
 *
 * @param req request containing auth info, requestId, and action (accepted/rejected)
 * @param res response either returning the updated friend request or an error
 */
export const postRespond: RestAPI<FriendRequest> = async (req, res) => {
  const body = withAuth(
    z.object({ requestId: z.string(), action: z.enum(["accepted", "rejected"]) }),
  ).safeParse(req.body);
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
    const friendReq = await respondToFriendRequest(
      user.username,
      body.data.payload.requestId,
      body.data.payload.action,
    );
    res.send(friendReq);
  } catch (e) {
    res.status(400).send({ error: "Bad Request" });
  }
};

/**
 * Handles removing a friend
 *
 * @param req request containing auth info and the friend's username to remove
 * @param res response either returning the removed friend's info or an error
 */
export const postRemove: RestAPI<SafeUserInfo> = async (req, res) => {
  const body = withAuth(z.object({ friendUsername: z.string() })).safeParse(req.body);
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
    const removed = await removeFriend(user.username, body.data.payload.friendUsername);
    res.send(removed);
  } catch (e) {
    res.status(400).send({ error: "Bad Request" });
  }
};
