import type { APIResponse } from "../util/types.ts";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { ErrorMsg, FriendRequest, SafeUserInfo, UserAuth } from "@gamenite/shared";

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
      payload: { toUsername },
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
      payload: { requestId, action },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get a user's accepted friends list
 */
export const getFriendList = async (username: string): APIResponse<SafeUserInfo[]> => {
  try {
    const res = await api.get<SafeUserInfo[] | ErrorMsg>(`${FRIEND_API_URL}/list/${username}`);
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
    const res = await api.get<FriendRequest[] | ErrorMsg>(
      `${FRIEND_API_URL}/requests/${username}`,
      { headers: { "Cache-Control": "no-cache" } }, // TEMPORARY to prevent caching while debugging friend request POST/GET. TODO: delete.
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const removeFriendRequest = async (
  auth: UserAuth,
  friendUsername: string,
): APIResponse<void> => {
  try {
    const res = await api.post<void | ErrorMsg>(`${FRIEND_API_URL}/remove`, {
      auth,
      payload: { friendUsername },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
