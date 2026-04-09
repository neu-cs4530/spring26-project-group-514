import { type GameInfo, withAuth, zGameKey, zGameMakeMovePayload } from "@gamenite/shared";
import { type RestAPI, type GameViewUpdates, type SocketAPI, type GameServer } from "../types.ts";
import {
  createGame,
  expireGameByTimer,
  gameServices,
  getGameById,
  getGameScores,
  getGameTimer,
  getGames,
  joinGame,
  startGame,
  updateGame,
  viewGame,
} from "../services/game.service.ts";
import { addMoveLogToChat } from "../services/chat.service.ts";
import { z } from "zod";
import { logSocketError } from "./socket.controller.ts";
import { checkAuth, enforceAuth } from "../services/auth.service.ts";

/**
 * Handle POST requests to `/api/game/create` by creating a game. The game
 * starts with one player, the user who made the POST request.
 */
export const postCreate: RestAPI<GameInfo> = async (req, res) => {
  const body = withAuth(zGameKey).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const game = await createGame(user, body.data.payload, new Date());
  res.send(game);
};

/**
 * Handle GET requests to `/api/game/:id`. Returns either 404 or a game info
 * object. Private games require authentication via x-username/x-password
 * headers and the requester must be a participant.
 */
export const getById: RestAPI<GameInfo, { id: string }> = async (req, res) => {
  const game = await getGameById(req.params.id);
  if (!game) {
    res.status(404).send({ error: "Game not found" });
    return;
  }

  if (game.isPrivate) {
    const username = req.headers["x-username"];
    const password = req.headers["x-password"];
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(401).send({ error: "Authentication required" });
      return;
    }
    const user = await checkAuth({ username, password });
    if (!user) {
      res.status(401).send({ error: "Invalid credentials" });
      return;
    }
    const isParticipant = game.players.some((p) => p.username === user.username);
    if (!isParticipant) {
      res.status(403).send({ error: "Not a participant in this game" });
      return;
    }
  }

  res.send(game);
};

/**
 * Handle GET requests to `/api/game/list` by returning information about all
 * games, sorted in reverse chronological order by creation.
 */
export const getList: RestAPI<GameInfo[]> = async (req, res) => {
  res.send(await getGames());
};

/**
 * Each active game player gets a dedicated room that sends messages
 * to just their socket connections. This function derives that room name from
 * the game id and the username.
 *
 * @param gameId - the game id, also the 'base' room name
 * @param userId - user id (not username!)
 * @returns a room name unique to that game id and user
 */
function userRoom(gameId: string, user: string) {
  return `${gameId}-${user}`;
}

/**
 * Handle the socket request sent by a user when they load to a game page. The
 * server's job is to respond with full information about the game's current
 * players and the appropriate view of the game's state. The server also needs
 * to register the user for future updates about the game's state.
 */
export const socketWatch: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const game = await getGameById(gameId);
    if (game?.isPrivate) {
      const isParticipant = game.players.some((p) => p.username === user.username);
      if (!isParticipant) throw new Error("Not a participant in this private game");
    }
    const { isPlayer, view, players } = await viewGame(gameId, user);
    const roomsToJoin = isPlayer ? [gameId, userRoom(gameId, user.userId)] : [gameId];
    await socket.join(roomsToJoin);
    socket.emit("gameWatched", { gameId, view, players });
    socket.emit("gameScoresUpdated", await getGameScores(gameId));
    const timer = await getGameTimer(gameId);
    if (timer) socket.emit("gameTimerUpdated", timer);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Broadcast view updates to appropriate users
 */
function sendViewUpdates(io: GameServer, gameId: string, updates: GameViewUpdates) {
  io.to(gameId).emit("gameStateUpdated", { ...updates.watchers, forPlayer: false });
  for (const { userId, view } of updates.players) {
    io.to(userRoom(gameId, userId)).emit("gameStateUpdated", { ...view, forPlayer: true });
  }
}

const gameTimerIntervals = new Map<string, ReturnType<typeof setInterval>>();

function clearGameTimer(gameId: string) {
  const timer = gameTimerIntervals.get(gameId);
  if (timer) {
    clearInterval(timer);
    gameTimerIntervals.delete(gameId);
  }
}

async function sendScoreUpdates(io: GameServer, gameId: string) {
  io.to(gameId).emit("gameScoresUpdated", await getGameScores(gameId));
}

async function maybeStartGameTimer(io: GameServer, gameId: string) {
  clearGameTimer(gameId);

  const initial = await getGameTimer(gameId);
  if (!initial || !initial.isRunning) return;

  io.to(gameId).emit("gameTimerStarted", initial);
  io.to(gameId).emit("gameTimerUpdated", initial);

  const interval = setInterval(async () => {
    const payload = await getGameTimer(gameId);
    if (!payload) {
      clearGameTimer(gameId);
      return;
    }

    io.to(gameId).emit("gameTimerUpdated", payload);

    if (payload.remainingSeconds <= 0) {
      clearGameTimer(gameId);
      const expired = await expireGameByTimer(gameId);
      if (expired) {
        sendViewUpdates(io, gameId, expired.views);
        await sendScoreUpdates(io, gameId);
      }
    }
  }, 1000);

  gameTimerIntervals.set(gameId, interval);
}

/**
 * Handle the socket request sent by a user when they try to join a game.
 */
export const socketJoinAsPlayer: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const game = await joinGame(gameId, user);

    // Let everyone know the user joined (`io` instead of `socket` includes
    // the joiner)
    io.to(gameId).emit("gamePlayersUpdated", game.players);

    // This socket should receive user-specific updates for this game, if it
    // isn't already
    if (!socket.rooms.has(userRoom(gameId, user.userId))) {
      await socket.join(userRoom(gameId, user.userId));
    }

    // If the game is full, it starts automatically
    if (game.players.length === gameServices[game.type].maxPlayers) {
      sendViewUpdates(io, gameId, await startGame(gameId, user));
      await sendScoreUpdates(io, gameId);
      await maybeStartGameTimer(io, gameId);
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a request to start the game.
 */
export const socketStart: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    sendViewUpdates(io, gameId, await startGame(gameId, user));
    await sendScoreUpdates(io, gameId);
    await maybeStartGameTimer(io, gameId);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a request to make a move in a game. After updating the game state,
 * this handler also generates a human-readable move description and broadcasts
 * it as a move log entry in the game's chat.
 */
export const socketMakeMove: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { gameId, move },
    } = withAuth(zGameMakeMovePayload).parse(body);
    const user = await enforceAuth(auth);
    const { views, moveDescription, chatId, done } = await updateGame(gameId, user, move);
    sendViewUpdates(io, gameId, views);
    await sendScoreUpdates(io, gameId);
    if (done) {
      clearGameTimer(gameId);
    }

    // Store the move description suffix and broadcast to the chat room
    const now = new Date();
    const moveLogPayload = await addMoveLogToChat(chatId, moveDescription, user, now);

    // Broadcast the move log to the chat room
    io.to(chatId).emit("chatMoveLog", moveLogPayload);
  } catch (err) {
    logSocketError(socket, err);
  }
};
