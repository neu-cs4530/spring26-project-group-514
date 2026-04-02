/**
 * Represents a player's stats summary visible to clients.
 */
export interface PlayerStats {
  username: string;
  display: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
}

/**
 * A single entry in the match history list.
 */
export interface MatchHistoryEntry {
  gameId: string;
  type: string;
  players: string[]; // usernames
  result: "win" | "loss" | "draw";
  endedAt: string; // ISO date
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * A leaderboard entry with rank.
 */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  display: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
}

/**
 * Valid time period filters for the leaderboard.
 */
export type LeaderboardPeriod = "week" | "month" | "all";
