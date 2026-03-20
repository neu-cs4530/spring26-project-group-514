import { type FriendRequest, type SafeUserInfo } from "@gamenite/shared";
import { getFriendsList, getPendingRequests } from "../services/friend.service.ts";
import { type RestAPI } from "../types.ts";

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
