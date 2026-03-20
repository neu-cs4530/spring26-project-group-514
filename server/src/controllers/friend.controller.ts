import { withAuth, type FriendRequest, type SafeUserInfo } from "@gamenite/shared";
import {
  getFriendsList,
  getPendingRequests,
  sendFriendRequest,
} from "../services/friend.service.ts";
import { type RestAPI } from "../types.ts";
import { z } from "zod";

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
 *
 * @param req request containing auth. info of user and username of requested friend.
 * @param res response either returning the friend request or an error.
 */
export const postRequest: RestAPI<FriendRequest> = async (req, res) => {
  const body = withAuth(z.object({ toUsername: z.string() })).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  try {
    const friendReq = await sendFriendRequest(
      body.data.auth.username,
      body.data.payload.toUsername,
    );
    res.send(friendReq);
  } catch (e) {
    res.status(400).send({ error: e instanceof Error ? e.message : "Bad Request" });
  }
};
