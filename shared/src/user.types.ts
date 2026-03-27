import { z } from "zod";

/**
 * Represents a "safe" user object that excludes sensitive information like
 * the password, suitable for exposing to clients,
 * - `username`: unique username of the user
 * - `display`: A display name
 * - `createdAt`: when this when the user registered.
 */
export interface SafeUserInfo {
  username: string;
  display: string;
  createdAt: Date;
}

/**
 * Achievement badges that can be earned by completing games.
 */
export type AchievementBadge =
  | "first-game"
  | "first-win"
  | "veteran-5-games"
  | "nim-master-3-wins"
  | "guess-master-3-wins";

/**
 * Badge payload for user profiles.
 */
export interface UserBadgesInfo {
  username: string;
  badges: AchievementBadge[];
}

/*** TYPES USED IN THE USER API ***/

/**
 * Represents allowed updates to a user.
 */
export type UserUpdateRequest = z.infer<typeof zUserUpdateRequest>;
export const zUserUpdateRequest = z.object({
  password: z.string().optional(),
  display: z.string().optional(),
});
