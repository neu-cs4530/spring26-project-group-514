import type { APIResponse } from "../util/types.ts";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { DirectChatInfo, DirectChatSummary, ErrorMsg } from "@gamenite/shared";

const DM_API_URL = `/api/dm`;

/**
 * Sends a GET request to get all DM conversations for a user.
 * Requires password header for authentication.
 */
export const getDMList = async (
  username: string,
  password: string,
): APIResponse<DirectChatSummary[]> => {
  try {
    const res = await api.get<DirectChatSummary[] | ErrorMsg>(`${DM_API_URL}/list/${username}`, {
      headers: { "x-password": password },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get a specific DM conversation with all messages.
 * Requires both username and password headers for authentication.
 */
export const getDMInfo = async (
  id: string,
  username: string,
  password: string,
): APIResponse<DirectChatInfo> => {
  try {
    const res = await api.get<DirectChatInfo | ErrorMsg>(`${DM_API_URL}/${id}`, {
      headers: { "x-username": username, "x-password": password },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
