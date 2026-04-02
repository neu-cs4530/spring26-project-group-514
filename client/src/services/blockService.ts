import type { APIResponse } from "../util/types.ts";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { ErrorMsg, SafeUserInfo, UserAuth } from "@gamenite/shared";

const BLOCK_API_URL = `/api/block`;

/**
 * Sends a POST request to block a user
 */
export const blockUser = async (
  auth: UserAuth,
  blockedUsername: string,
): APIResponse<SafeUserInfo> => {
  try {
    const res = await api.post<SafeUserInfo | ErrorMsg>(`${BLOCK_API_URL}/block`, {
      auth,
      payload: { blockedUsername },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to unblock a user
 */
export const unblockUser = async (
  auth: UserAuth,
  blockedUsername: string,
): APIResponse<SafeUserInfo> => {
  try {
    const res = await api.post<SafeUserInfo | ErrorMsg>(`${BLOCK_API_URL}/unblock`, {
      auth,
      payload: { blockedUsername },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get a user's block list
 */
export const getBlockList = async (
  username: string,
  password: string,
): APIResponse<SafeUserInfo[]> => {
  try {
    const res = await api.get<SafeUserInfo[] | ErrorMsg>(`${BLOCK_API_URL}/list/${username}`, {
      headers: { "x-password": password },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
