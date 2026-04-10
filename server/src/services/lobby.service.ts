import { type LobbyInfo, type GameKey, type LobbySettingsPayload } from "@gamenite/shared";
import { type UserWithId } from "../types.ts";
import { LobbyRepo } from "../repository.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { randomUUID } from "node:crypto";
import { createChat } from "./chat.service.ts";
import { gameServices } from "./game.service.ts";

const defaultLobbySettings: LobbySettingsPayload = {
  mode: "standard",
  difficulty: "normal",
  timerSeconds: null,
};

function ensureLobbyNotStarted(startedGameId: string | undefined) {
  if (startedGameId) throw new Error("Lobby already started");
}

/**
 * Expand a stored lobby record into a full LobbyInfo object.
 */
async function populateLobbyInfo(lobbyId: string): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.get(lobbyId);
  return {
    lobbyId,
    type: lobby.type,
    isPrivate: lobby.isPrivate,
    code: lobby.code,
    createdBy: await populateSafeUserInfo(lobby.createdBy),
    settings: lobby.settings,
    chatId: lobby.chatId,
    startedGameId: lobby.startedGameId,
    createdAt: new Date(lobby.createdAt),
    players: await Promise.all(
      lobby.players.map(async ({ userId, status }) => ({
        user: await populateSafeUserInfo(userId),
        status,
      })),
    ),
  };
}

/**
 * Create a new lobby.
 */
export async function createLobby(
  user: UserWithId,
  type: GameKey,
  isPrivate: boolean,
  createdAt: Date,
): Promise<LobbyInfo> {
  const code = randomUUID().slice(0, 8).toUpperCase();
  const chat = await createChat(createdAt);
  const lobbyId = await LobbyRepo.add({
    type,
    isPrivate,
    code,
    createdBy: user.userId,
    settings: defaultLobbySettings,
    chatId: chat.chatId,
    createdAt: createdAt.toISOString(),
    players: [{ userId: user.userId, status: "joined" }],
  });
  return populateLobbyInfo(lobbyId);
}

/**
 * Get a lobby by its ID.
 */
export async function getLobbyById(lobbyId: string): Promise<LobbyInfo | null> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) return null;
  return populateLobbyInfo(lobbyId);
}

/**
 * Get a lobby by its join code.
 */
export async function getLobbyByCode(code: string): Promise<LobbyInfo | null> {
  const keys = await LobbyRepo.getAllKeys();
  for (const key of keys) {
    const lobby = await LobbyRepo.get(key);
    if (lobby.code === code) return populateLobbyInfo(key);
  }
  return null;
}

/**
 * Get all public lobbies.
 */
export async function getPublicLobbies(): Promise<LobbyInfo[]> {
  const keys = await LobbyRepo.getAllKeys();
  const all = await Promise.all(keys.map(populateLobbyInfo));
  return all
    .filter((lobby) => !lobby.isPrivate && !lobby.startedGameId)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get all pending lobby invitations for a user.
 */
export async function getInvitedLobbies(user: UserWithId): Promise<LobbyInfo[]> {
  const keys = await LobbyRepo.getAllKeys();
  const invitedKeys: string[] = [];

  for (const key of keys) {
    const lobby = await LobbyRepo.get(key);
    const isInvited = lobby.players.some(
      (player) => player.userId === user.userId && player.status === "pending",
    );

    if (!lobby.startedGameId && isInvited) {
      invitedKeys.push(key);
    }
  }

  const invited = await Promise.all(invitedKeys.map(populateLobbyInfo));
  return invited.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Invite a player to a lobby by username.
 */
export async function invitePlayer(
  lobbyId: string,
  inviter: UserWithId,
  targetUsername: string,
): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  if (lobby.createdBy !== inviter.userId) throw new Error(`Only the host can invite players`);
  ensureLobbyNotStarted(lobby.startedGameId);

  // Find the target user
  const { UserRepo: userRepo } = await import("../repository.ts");
  const allUserKeys = await userRepo.getAllKeys();
  let targetUserId: string | undefined;
  for (const key of allUserKeys) {
    const u = await userRepo.get(key);
    if (u.username === targetUsername) {
      targetUserId = key;
      break;
    }
  }
  if (!targetUserId) throw new Error(`User ${targetUsername} not found`);

  const alreadyInLobby = lobby.players.some((p) => p.userId === targetUserId);
  if (alreadyInLobby) throw new Error(`User ${targetUsername} is already in this lobby`);

  lobby.players = [...lobby.players, { userId: targetUserId, status: "pending" }];
  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Join a lobby by lobby ID (accepting an invite) or by code.
 */
export async function joinLobby(
  lobbyId: string,
  user: UserWithId,
  byCode = false,
): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  ensureLobbyNotStarted(lobby.startedGameId);

  const playerEntry = lobby.players.find((p) => p.userId === user.userId);
  if (playerEntry) {
    // Already invited — update status to joined
    playerEntry.status = "joined";
  } else {
    // Joining a public lobby directly, or a private lobby via code
    if (lobby.isPrivate && !byCode) throw new Error(`Cannot join a private lobby without an invite`);
    lobby.players = [...lobby.players, { userId: user.userId, status: "joined" }];
  }

  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Join a lobby by its unique code.
 */
export async function joinLobbyByCode(code: string, user: UserWithId): Promise<LobbyInfo> {
  const keys = await LobbyRepo.getAllKeys();
  for (const key of keys) {
    const lobby = await LobbyRepo.get(key);
    if (lobby.code === code) return joinLobby(key, user, true);
  }
  throw new Error(`No lobby found with code ${code}`);
}

/**
 * Leave a lobby.
 */
export async function leaveLobby(lobbyId: string, user: UserWithId): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  if (lobby.createdBy === user.userId) throw new Error(`Host cannot leave their own lobby`);
  ensureLobbyNotStarted(lobby.startedGameId);

  lobby.players = lobby.players.filter((p) => p.userId !== user.userId);
  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Remove a player from a lobby (host only).
 */
export async function removePlayer(
  lobbyId: string,
  host: UserWithId,
  targetUsername: string,
): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  if (lobby.createdBy !== host.userId) throw new Error(`Only the host can remove players`);
  ensureLobbyNotStarted(lobby.startedGameId);

  const { UserRepo: userRepo } = await import("../repository.ts");
  const allUserKeys = await userRepo.getAllKeys();
  let targetUserId: string | undefined;
  for (const key of allUserKeys) {
    const u = await userRepo.get(key);
    if (u.username === targetUsername) {
      targetUserId = key;
      break;
    }
  }
  if (!targetUserId) throw new Error(`User ${targetUsername} not found`);
  if (targetUserId === lobby.createdBy) throw new Error(`Cannot remove the host`);

  lobby.players = lobby.players.filter((p) => p.userId !== targetUserId);
  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Decline a pending private lobby invite.
 */
export async function declineInvite(lobbyId: string, user: UserWithId): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  ensureLobbyNotStarted(lobby.startedGameId);

  const entry = lobby.players.find((p) => p.userId === user.userId);
  if (!entry) throw new Error("You are not invited to this lobby");
  entry.status = "declined";

  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Update host-controlled lobby settings.
 */
export async function updateLobbySettings(
  lobbyId: string,
  host: UserWithId,
  settings: LobbySettingsPayload,
): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  if (lobby.createdBy !== host.userId) throw new Error("Only the host can update settings");
  ensureLobbyNotStarted(lobby.startedGameId);

  lobby.settings = settings;
  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}

/**
 * Start the game from a lobby (host only).
 * Returns the lobbyId and gameType so the controller can create the game.
 */
export async function startLobby(
  lobbyId: string,
  host: UserWithId,
): Promise<{
  type: GameKey;
  playerIds: string[];
  timerSeconds: number | null;
  isPrivate: boolean;
}> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  if (lobby.createdBy !== host.userId) throw new Error(`Only the host can start the game`);
  ensureLobbyNotStarted(lobby.startedGameId);

  const joinedPlayers = lobby.players.filter((p) => p.status === "joined");
  const { minPlayers, maxPlayers } = gameServices[lobby.type];
  if (joinedPlayers.length < minPlayers) throw new Error("Min player count not met");
  if (maxPlayers !== null && joinedPlayers.length > maxPlayers)
    throw new Error(`Max player count exceeded. Max players: ${maxPlayers}`);

  // Mark as starting immediately to prevent concurrent start requests
  lobby.startedGameId = "starting";
  await LobbyRepo.set(lobbyId, lobby);

  return {
    type: lobby.type,
    playerIds: joinedPlayers.map((p) => p.userId),
    timerSeconds: lobby.settings.timerSeconds,
    isPrivate: lobby.isPrivate,
  };
}

/**
 * Marks a lobby as started by storing the resulting game id.
 */
export async function markLobbyStarted(lobbyId: string, gameId: string): Promise<LobbyInfo> {
  const lobby = await LobbyRepo.find(lobbyId);
  if (!lobby) throw new Error(`Lobby ${lobbyId} not found`);
  lobby.startedGameId = gameId;
  await LobbyRepo.set(lobbyId, lobby);
  return populateLobbyInfo(lobbyId);
}
