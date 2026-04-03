import type {
  ErrorMsg,
  LeaderboardEntry,
  LeaderboardPeriod,
  MatchHistoryEntry,
  PaginatedResponse,
  PlayerStats,
  UserAuth,
} from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { APIResponse } from "../util/types.ts";

const STATS_API_URL = `/api/stats`;

/**
 * Get a player's aggregated stats.
 */
export const getPlayerStats = async (username: string): APIResponse<PlayerStats> => {
  try {
    const res = await api.get<PlayerStats | ErrorMsg>(`${STATS_API_URL}/player/${username}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Get paginated match history for a user.
 */
export const getMatchHistory = async (
  username: string,
  page = 1,
  limit = 10,
  filters?: { gameType?: string; opponent?: string; dateFrom?: string; dateTo?: string },
): APIResponse<PaginatedResponse<MatchHistoryEntry>> => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.gameType) params.set("gameType", filters.gameType);
    if (filters?.opponent) params.set("opponent", filters.opponent);
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);

    const res = await api.get<PaginatedResponse<MatchHistoryEntry> | ErrorMsg>(
      `${STATS_API_URL}/history/${username}?${params.toString()}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Get the global leaderboard.
 */
export const getLeaderboard = async (
  page = 1,
  limit = 10,
  period: LeaderboardPeriod = "all",
): APIResponse<PaginatedResponse<LeaderboardEntry>> => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      period,
    });
    const res = await api.get<PaginatedResponse<LeaderboardEntry> | ErrorMsg>(
      `${STATS_API_URL}/leaderboard?${params.toString()}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Set leaderboard opt-out preference.
 */
export const setLeaderboardOptOut = async (
  auth: UserAuth,
  optOut: boolean,
): APIResponse<{ success: boolean }> => {
  try {
    const res = await api.post<{ success: boolean } | ErrorMsg>(
      `${STATS_API_URL}/leaderboard-opt-out`,
      { auth, payload: { optOut } },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Get leaderboard opt-out status.
 */
export const getLeaderboardOptOut = async (username: string): APIResponse<{ optOut: boolean }> => {
  try {
    const res = await api.get<{ optOut: boolean } | ErrorMsg>(
      `${STATS_API_URL}/leaderboard-opt-out/${username}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
