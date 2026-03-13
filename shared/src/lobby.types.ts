import { z } from "zod";
import { type SafeUserInfo } from "./user.types.ts";
import { zGameKey, type GameKey } from "./game.types.ts";

/**
 * The status of a player's invitation to a lobby.
 * - `pending`: invited but hasn't responded
 * - `joined`: accepted and in the lobby
 * - `declined`: declined the invitation
 */
export type InviteStatus = "pending" | "joined" | "declined";

/**
 * Represents a player's invite entry in the lobby.
 */
export interface LobbyPlayer {
  user: SafeUserInfo;
  status: InviteStatus;
}

/**
 * Represents lobby information returned to clients.
 * - `lobbyId`: database key
 * - `type`: which game this lobby is for
 * - `isPrivate`: whether the lobby is private
 * - `code`: unique join code
 * - `createdBy`: the lobby host
 * - `players`: list of players and their invite statuses
 * - `createdAt`: when the lobby was created
 */
export interface LobbyInfo {
  lobbyId: string;
  type: GameKey;
  isPrivate: boolean;
  code: string;
  createdBy: SafeUserInfo;
  players: LobbyPlayer[];
  createdAt: Date;
}

/*** TYPES USED IN THE LOBBY API ***/

export type CreateLobbyPayload = z.infer<typeof zCreateLobbyPayload>;
export const zCreateLobbyPayload = z.object({
  type: zGameKey,
  isPrivate: z.boolean(),
});

export type InvitePlayerPayload = z.infer<typeof zInvitePlayerPayload>;
export const zInvitePlayerPayload = z.object({
  username: z.string(),
});

export type JoinLobbyByCodePayload = z.infer<typeof zJoinLobbyByCodePayload>;
export const zJoinLobbyByCodePayload = z.object({
  code: z.string(),
});

export type RemovePlayerPayload = z.infer<typeof zRemovePlayerPayload>;
export const zRemovePlayerPayload = z.object({
  username: z.string(),
});
