import {
  type GameInfo,
  type GameKey,
  type GamePlayerScore,
  type GameScoresPayload,
  type GameTimerPayload,
  type GuessState,
  type NimState,
  type TaggedGameView,
} from "@gamenite/shared";
import { createChat } from "./chat.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { type GameServicer } from "../games/gameServiceManager.ts";
import { nimGameService } from "../games/nim.ts";
import { guessGameService } from "../games/guess.ts";
import { type GameViewUpdates, type UserWithId } from "../types.ts";
import { GameHistoryRepo, GameRepo, PlayerStatsRepo } from "../repository.ts";
import { updatePlayerStatsOnGameEnd } from "./stats.service.ts";

/**
 * The service interface for individual games
 */
export const gameServices: { [key in GameKey]: GameServicer } = {
  nim: nimGameService,
  guess: guessGameService,
};

/**
 * Derive current leaderboard scores for all players in a game.
 *
 * The score shown in the game panel is the player's total win count so far,
 * not the current round's move/result state.
 */
async function deriveScores(gameId: string): Promise<GamePlayerScore[]> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`scores requested for invalid game ${gameId}`);

  return Promise.all(
    game.players.map(async (userId, playerIndex) => {
      const stats = await PlayerStatsRepo.find(userId);
      return {
        playerIndex,
        score: stats?.wins ?? 0,
      };
    }),
  );
}

/**
 * Expand a stored game
 *
 * @param gameId - Valid game id
 * @returns the expanded game info object
 */
async function populateGameInfo(gameId: string): Promise<GameInfo> {
  const game = await GameRepo.get(gameId);
  return {
    gameId,
    createdBy: await populateSafeUserInfo(game.createdBy),
    chat: game.chat,
    createdAt: new Date(game.createdAt),
    isPrivate: game.isPrivate,
    players: await Promise.all(game.players.map(populateSafeUserInfo)),
    type: game.type,
    status: !game.state ? "waiting" : game.done ? "done" : "active",
    minPlayers: gameServices[game.type].minPlayers,
  };
}

/**
 * Create and store a new game
 *
 * @param user - Initial player in the game's waiting room
 * @param type - Game key
 * @param createdAt - Creation time for this game
 * @returns the new game's info object
 */
export async function createGame(
  user: UserWithId,
  type: GameKey,
  createdAt: Date,
  timerDurationSeconds: number | null = 300,
  isPrivate: boolean = false,
): Promise<GameInfo> {
  const chat = await createChat(createdAt);
  const gameId = await GameRepo.add({
    type,
    done: false,
    isPrivate,
    chat: chat.chatId,
    createdAt: createdAt.toISOString(),
    createdBy: user.userId,
    players: [user.userId],
    timerDurationSeconds,
  });
  return populateGameInfo(gameId);
}

/**
 * Retrieves a single game from the database. If you expect the id to be valid, use `forceGameById`.
 *
 * @param gameId - Ostensible game id
 * @returns the game's info object, or null
 */
export async function getGameById(gameId: string): Promise<GameInfo | null> {
  const game = await GameRepo.find(gameId);
  if (!game) return null;
  return populateGameInfo(gameId);
}

/**
 * Adds a user to a game that hasn't started yet. If the resulting game object has the maximum
 * allowed number of players, it is the responsibility of the caller to start the game.
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the game's info object, with the `user` listed among the players
 * @throws if the game id is not valid, if the game has started, or if the game cannot accept more
 * players
 */
export async function joinGame(gameId: string, user: UserWithId): Promise<GameInfo> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} joining invalid game`);
  if (game.state) {
    throw new Error(`user ${user.username} joining game that started`);
  }
  if (game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} joining game they are in already`);
  }
  if (game.players.length === gameServices[game.type].maxPlayers) {
    throw new Error(`user ${user.username} joining full`);
  }

  game.players = [...game.players, user.userId];
  await GameRepo.set(gameId, game);

  return populateGameInfo(gameId);
}

/**
 * Initializes a game that hasn't started yet
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the necessary views for everyone watching the game
 * @throws if the game id is not valid, if the game already started, or if the game lacks enough
 * players to start
 */
export async function startGame(gameId: string, user: UserWithId): Promise<GameViewUpdates> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} starting invalid game`);
  if (game.state) {
    throw new Error(`user ${user.username} starting game that started`);
  }

  const key: GameKey = game.type;

  if (game.players.length < gameServices[key].minPlayers) {
    throw new Error(`user ${user.username} starting underpopulated game`);
  }
  if (!game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} starting game they're not in`);
  }
  const { state, views } = gameServices[key].create(game.players);

  game.state = state;
  if (game.timerDurationSeconds && game.timerDurationSeconds > 0) {
    game.timerEndsAt = new Date(Date.now() + game.timerDurationSeconds * 1000).toISOString();
  }
  await GameRepo.set(gameId, game);

  return Promise.resolve(views);
}

/**
 * Get a list of all games
 *
 * @returns a list of game summaries, ordered reverse chronologically
 */
export async function getGames(): Promise<GameInfo[]> {
  const keys = await GameRepo.getAllKeys();
  const unsorted = await Promise.all(keys.map(populateGameInfo));

  return unsorted
    .filter((game) => !game.isPrivate)
    .toSorted((game1, game2) => game2.createdAt.getTime() - game1.createdAt.getTime());
}

/**
 * Get current in-game scores for all players in a game.
 *
 * @param gameId - Ostensible game id
 * @returns the score payload for socket broadcast
 * @throws if the game id is not valid
 */
export async function getGameScores(gameId: string): Promise<GameScoresPayload> {
  return {
    gameId,
    scores: await deriveScores(gameId),
  };
}

export async function getGameTimer(gameId: string): Promise<GameTimerPayload | null> {
  const game = await GameRepo.find(gameId);
  if (!game || !game.timerDurationSeconds || !game.timerEndsAt) {
    return null;
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((new Date(game.timerEndsAt).getTime() - Date.now()) / 1000),
  );

  return {
    gameId,
    remainingSeconds,
    isRunning: !!game.state && !game.done && remainingSeconds > 0,
  };
}

function buildViewsFromCurrentState(game: {
  type: GameKey;
  state: unknown;
  players: string[];
}): GameViewUpdates {
  return {
    watchers: gameServices[game.type].view(game.state, -1),
    players: game.players.map((userId, playerIndex) => ({
      userId,
      view: gameServices[game.type].view(game.state, playerIndex),
    })),
  };
}

export async function expireGameByTimer(gameId: string): Promise<GameUpdateResult | null> {
  const game = await GameRepo.find(gameId);
  if (!game || !game.state || game.done) {
    return null;
  }

  game.done = true;
  await GameRepo.set(gameId, game);

  await GameHistoryRepo.set(gameId, {
    type: game.type,
    players: game.players,
    endedAt: new Date().toISOString(),
    state: game.state,
    endedByTimer: true,
  });

  return {
    views: buildViewsFromCurrentState(game as { type: GameKey; state: unknown; players: string[] }),
    moveDescription: "timer expired",
    chatId: game.chat,
    done: true,
  };
}

/**
 * Represents the result of a game update, including view updates and the
 * move description suffix (the display name is prepended by the caller).
 */
export interface GameUpdateResult {
  views: GameViewUpdates;
  moveDescription: string;
  chatId: string;
  done?: boolean;
}

/**
 * Updates a game state and returns the necessary view updates
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @param move - Unsanitized game move
 * @returns the view updates and move description to send to players and watchers
 * @throws if the game id or move is not valid
 */
export async function updateGame(
  gameId: string,
  user: UserWithId,
  move: unknown,
): Promise<GameUpdateResult> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} acted on an invalid game`);
  if (!game.state) {
    throw new Error(`user ${user.username} made a move in game of that hadn't started`);
  }
  const playerIndex = game.players.findIndex((userId) => userId === user.userId);
  if (playerIndex < 0) {
    throw new Error(`user ${user.username} made a move in a game they weren't playing`);
  }
  const result = gameServices[game.type].update(game.state, move, playerIndex, game.players);
  if (!result) throw new Error(`user ${user.username} made an invalid move in ${game.type}`);

  game.state = result.state;
  game.done = game.done || result.done;
  await GameRepo.set(gameId, game);

  if (result.done) {
    await GameHistoryRepo.set(gameId, {
      type: game.type,
      players: game.players,
      endedAt: new Date().toISOString(),
      state: game.state,
    });
    await updatePlayerStatsOnGameEnd(game.type, game.state, game.players);
  }

  return {
    views: result.views,
    moveDescription: result.moveDescription,
    chatId: game.chat,
    done: game.done,
  };
}

/**
 * View a game as a specific user
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns A boolean for whether that user is a player, the player's view, and the list of players
 */
export async function viewGame(gameId: string, user: UserWithId) {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} viewed an invalid game id`);
  const playerIndex = game.players.findIndex((userId) => userId === user.userId);
  let view: TaggedGameView | null = null;
  if (game.state) {
    view = gameServices[game.type].view(game.state, playerIndex);
  }
  return {
    isPlayer: playerIndex >= 0,
    view,
    players: await Promise.all(game.players.map(populateSafeUserInfo)),
  };
}
