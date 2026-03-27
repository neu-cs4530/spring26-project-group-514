import type {
  ErrorMsg,
  LobbyInfo,
  LobbySettingsPayload,
  UserAuth,
  CreateLobbyPayload,
  InvitePlayerPayload,
} from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { APIResponse } from "../util/types.ts";

const LOBBY_API_URL = "/api/lobby";

export const createLobby = async (
  auth: UserAuth,
  payload: CreateLobbyPayload,
): APIResponse<LobbyInfo> => {
  try {
    const res = await api.post<LobbyInfo | ErrorMsg>(`${LOBBY_API_URL}/create`, { auth, payload });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const getLobbyById = async (lobbyId: string): APIResponse<LobbyInfo> => {
  try {
    const res = await api.get<LobbyInfo | ErrorMsg>(`${LOBBY_API_URL}/${lobbyId}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const getLobbyList = async (): APIResponse<LobbyInfo[]> => {
  try {
    const res = await api.get<LobbyInfo[] | ErrorMsg>(`${LOBBY_API_URL}/list`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const joinLobbyByCode = async (auth: UserAuth, code: string): APIResponse<LobbyInfo> => {
  try {
    const res = await api.post<LobbyInfo | ErrorMsg>(`${LOBBY_API_URL}/join-by-code`, {
      auth,
      payload: { code },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const inviteLobbyPlayer = async (
  auth: UserAuth,
  lobbyId: string,
  payload: InvitePlayerPayload,
): APIResponse<LobbyInfo> => {
  try {
    const res = await api.post<LobbyInfo | ErrorMsg>(`${LOBBY_API_URL}/${lobbyId}/invite`, {
      auth,
      payload,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const updateLobbySettings = async (
  auth: UserAuth,
  lobbyId: string,
  payload: LobbySettingsPayload,
): APIResponse<LobbyInfo> => {
  try {
    const res = await api.post<LobbyInfo | ErrorMsg>(`${LOBBY_API_URL}/${lobbyId}/settings`, {
      auth,
      payload,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
