import type { APIResponse } from "../util/types.ts";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { ErrorMsg, FriendRequest, FriendSummary, UserAuth } from "@gamenite/shared";

const FRIEND_API_URL = `/api/friend`;

/**
 * Sends a POST request to send a friend request to another user
 */
export const sendFriendRequest = async (
  auth: UserAuth,
  toUsername: string,
): APIResponse<FriendRequest> => {
  try {
    const res = await api.post<FriendRequest | ErrorMsg>(`${FRIEND_API_URL}/request`, {
      auth,
      toUsername,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to accept or reject an incoming friend request
 */
export const respondToRequest = async (
  auth: UserAuth,
  requestId: string,
  action: "accepted" | "rejected",
): APIResponse<FriendRequest> => {
  try {
    const res = await api.post<FriendRequest | ErrorMsg>(`${FRIEND_API_URL}/respond`, {
      auth,
      requestId,
      action,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get a user's accepted friends list
 */
export const getFriendList = async (username: string): APIResponse<FriendSummary[]> => {
  try {
    const res = await api.get<FriendSummary[] | ErrorMsg>(`${FRIEND_API_URL}/list/${username}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get all pending incoming and outgoing friend requests
 */
export const getPendingRequests = async (username: string): APIResponse<FriendRequest[]> => {
  try {
    const res = await api.get<FriendRequest[] | ErrorMsg>(`${FRIEND_API_URL}/requests/${username}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
