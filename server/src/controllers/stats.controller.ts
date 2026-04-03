import { type LeaderboardPeriod, withAuth } from "@gamenite/shared";
import { type RestAPI } from "../types.ts";
import {
  getLeaderboard,
  getLeaderboardOptOut,
  getMatchHistory,
  getPlayerStats,
  setLeaderboardOptOut,
} from "../services/stats.service.ts";
import { checkAuth } from "../services/auth.service.ts";
import { z } from "zod";

/**
 * GET /api/stats/player/:username
 * Returns a player's aggregated stats.
 */
export const getPlayerStatsHandler: RestAPI = async (req, res) => {
  const username = req.params.username;
  if (!username) {
    res.status(400).send({ error: "Username is required" });
    return;
  }
  const stats = await getPlayerStats(username);
  if (!stats) {
    res.send({
      username,
      display: username,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      winRate: 0,
      badges: [],
    });
    return;
  }
  res.send(stats);
};

/**
 * GET /api/stats/history/:username
 * Returns paginated match history for a user.
 * Query params: page, limit, gameType, opponent, dateFrom, dateTo
 */
export const getMatchHistoryHandler: RestAPI = async (req, res) => {
  const username = req.params.username;
  if (!username) {
    res.status(400).send({ error: "Username is required" });
    return;
  }
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const filters = {
    gameType: (req.query.gameType as string) || undefined,
    opponent: (req.query.opponent as string) || undefined,
    dateFrom: (req.query.dateFrom as string) || undefined,
    dateTo: (req.query.dateTo as string) || undefined,
  };

  const result = await getMatchHistory(username, page, limit, filters);
  res.send(result);
};

/**
 * GET /api/stats/leaderboard
 * Returns the global leaderboard with pagination.
 * Query params: page, limit, period (week|month|all)
 */
export const getLeaderboardHandler: RestAPI = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const period = (req.query.period as LeaderboardPeriod) || "all";

  if (!["week", "month", "all"].includes(period)) {
    res.status(400).send({ error: "Invalid period. Use 'week', 'month', or 'all'" });
    return;
  }

  const result = await getLeaderboard(page, limit, period);
  res.send(result);
};

/**
 * POST /api/stats/leaderboard-opt-out
 * Toggle leaderboard opt-out for the authenticated user.
 */
export const postLeaderboardOptOut: RestAPI = async (req, res) => {
  const body = withAuth(z.object({ optOut: z.boolean() })).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  await setLeaderboardOptOut(user.userId, body.data.payload.optOut);
  res.send({ success: true });
};

/**
 * GET /api/stats/leaderboard-opt-out/:username
 * Get leaderboard opt-out status.
 */
export const getLeaderboardOptOutHandler: RestAPI = async (req, res) => {
  const username = req.params.username;
  if (!username) {
    res.status(400).send({ error: "Username is required" });
    return;
  }

  // Find userId from username
  const { getUserByUsername } = await import("../services/auth.service.ts");
  const user = await getUserByUsername(username);
  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  const optOut = await getLeaderboardOptOut(user.userId);
  res.send({ optOut });
};
